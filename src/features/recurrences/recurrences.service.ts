import type { Prisma, PrismaClient, RecurrenceRule, Tag } from '@usegonche/database';
import type { RRule } from 'rrule';
import { changedFields, hasChanges } from '../../lib/diff.js';
import { AppError } from '../../lib/errors.js';
import { scoped } from '../../lib/owner.js';
import { type Paged, type PageParams, pageArgs, pageOrder } from '../../lib/pagination.js';
import { localDateOf, zonedToUtc } from '../../lib/time.js';
import { buildRule } from './recurrences.rrule.js';
import type { CreateRecurrenceInput, UpdateRecurrenceInput } from './recurrences.schemas.js';

type Db = PrismaClient | Prisma.TransactionClient;

export type RecurrenceView = RecurrenceRule & { tags: Tag[] };

/** Occurrences are generated this many days ahead of today. */
export const WINDOW_DAYS = 14;
const DAY_MS = 86_400_000;

const include = { tags: { include: { tag: true }, orderBy: { tag: { name: 'asc' as const } } } };
type Row = RecurrenceRule & { tags: { tag: Tag }[] };
const toView = ({ tags, ...rule }: Row): RecurrenceView => ({ ...rule, tags: tags.map(link => link.tag) });

const addDays = (date: Date, days: number): Date => new Date(date.getTime() + days * DAY_MS);
const latest = (a: Date, b: Date): Date => (a > b ? a : b);

const invalidReference = (field: string): AppError => new AppError('validation_error', 422, [{ code: 'not_found', field }]);

const timeZoneOf = async (prisma: Db, ownerId: string): Promise<string> => (await prisma.userSettings.findUnique({ select: { timezone: true }, where: { ownerId } }))?.timezone ?? 'UTC';

/** The user's current calendar day (their `user_settings.timezone`, UTC when unset) as a UTC-midnight `Date`. */
export const getToday = async (prisma: Db, ownerId: string, now: Date = new Date()): Promise<Date> => new Date(`${localDateOf(now, await timeZoneOf(prisma, ownerId))}T00:00:00Z`);

const expand = (rule: RecurrenceRule): RRule => {
	const built = buildRule(rule.rule, rule.startDate);
	if (!built) throw new AppError('invalid_state', 409);
	return built;
};

const assertReferences = async (prisma: Db, ownerId: string, refs: { goalId?: string | null; projectId?: string | null; tagIds?: string[] }): Promise<void> => {
	if (refs.projectId && !(await prisma.project.findFirst({ select: { id: true }, where: scoped(ownerId, { id: refs.projectId }) }))) throw invalidReference('projectId');
	if (refs.goalId && !(await prisma.goal.findFirst({ select: { id: true }, where: scoped(ownerId, { id: refs.goalId }) }))) throw invalidReference('goalId');
	if (refs.tagIds?.length && (await prisma.tag.count({ where: scoped(ownerId, { id: { in: refs.tagIds } }) })) !== refs.tagIds.length) throw invalidReference('tagIds');
};

type RuleWithTagIds = RecurrenceRule & { tags: { tagId: string }[] };
const withTagIds = { tags: { select: { tagId: true } } };

/** Creates the occurrences of `dates` that do not exist yet (`recurrenceId + occurrenceDate` is unique), so running it twice is harmless. With a time of day, each one also gets a planned time block. */
const createOccurrences = async (tx: Db, rule: RuleWithTagIds, dates: Date[]): Promise<void> => {
	if (dates.length === 0) return;
	const existing = await tx.task.findMany({ select: { occurrenceDate: true }, where: scoped(rule.ownerId, { occurrenceDate: { in: dates }, recurrenceId: rule.id }) });
	const taken = new Set(existing.map(task => task.occurrenceDate?.getTime()));
	const timeZone = rule.startMinute == null ? 'UTC' : await timeZoneOf(tx, rule.ownerId);
	for (const date of dates) {
		if (taken.has(date.getTime())) continue;
		const { id: taskId } = await tx.task.create({
			data: {
				description: rule.description,
				dueDate: date,
				estimatedMinutes: rule.estimatedMinutes,
				goalId: rule.goalId,
				occurrenceDate: date,
				ownerId: rule.ownerId,
				priority: rule.priority,
				projectId: rule.projectId,
				recurrenceId: rule.id,
				tags: { create: rule.tags.map(({ tagId }) => ({ tagId })) },
				title: rule.title,
			},
			select: { id: true },
		});
		if (rule.startMinute != null && rule.durationMinutes != null) {
			const plannedStart = zonedToUtc(date.toISOString().slice(0, 10), rule.startMinute, timeZone);
			await tx.timeBlock.create({ data: { ownerId: rule.ownerId, plannedEnd: new Date(plannedStart.getTime() + rule.durationMinutes * 60_000), plannedStart, taskId } });
		}
	}
};

/** Generates what is missing from the last examined day (or today) up to `today + WINDOW_DAYS`. Days already examined are never revisited, so a deleted occurrence stays deleted. */
const materialize = async (tx: Db, rule: RuleWithTagIds, today: Date): Promise<void> => {
	const from = rule.generatedUntil ? latest(addDays(rule.generatedUntil, 1), today) : today;
	const to = addDays(today, WINDOW_DAYS);
	if (from > to) return;
	await createOccurrences(tx, rule, expand(rule).between(from, to, true));
	await tx.recurrenceRule.updateMany({ data: { generatedUntil: to }, where: scoped(rule.ownerId, { id: rule.id }) });
};

const loadRule = async (tx: Db, ownerId: string, id: string): Promise<RuleWithTagIds> => {
	const rule = await tx.recurrenceRule.findFirst({ include: withTagIds, where: scoped(ownerId, { id }) });
	if (!rule) throw new AppError('not_found', 404);
	return rule;
};

/**
 * Future occurrences that are still untouched: `todo`, today or later, no attachments (kept so no file is orphaned) and no time block
 * that was started, finished or moved (that is history).
 */
const untouchedFuture = (ownerId: string, recurrenceId: string, today: Date): Prisma.TaskWhereInput =>
	scoped(ownerId, {
		attachments: { none: {} },
		occurrenceDate: { gte: today },
		recurrenceId,
		status: 'todo' as const,
		timeBlocks: { none: { NOT: { rescheduledFromId: null, status: 'planned' as const } } },
	});

export const getRecurrence = async (prisma: Db, ownerId: string, id: string): Promise<RecurrenceView> => {
	const rule = await prisma.recurrenceRule.findFirst({ include, where: scoped(ownerId, { id }) });
	if (!rule) throw new AppError('not_found', 404);
	return toView(rule);
};

/** One page of recurrence rules (newest first) with the total. */
export const listRecurrences = async (prisma: PrismaClient, ownerId: string, page: PageParams): Promise<Paged<RecurrenceView>> => {
	const where = scoped(ownerId);
	const [rows, total] = await Promise.all([prisma.recurrenceRule.findMany({ include, orderBy: pageOrder('createdAt'), ...pageArgs(page), where }), prisma.recurrenceRule.count({ where })]);
	return { items: rows.map(toView), total };
};

/** Creates the rule and its first occurrences (from today, up to the window) in one transaction. */
export const createRecurrence = (prisma: PrismaClient, ownerId: string, input: CreateRecurrenceInput, today: Date): Promise<RecurrenceView> =>
	prisma.$transaction(async tx => {
		await assertReferences(tx, ownerId, input);
		const { id } = await tx.recurrenceRule.create({
			data: {
				description: input.description,
				estimatedMinutes: input.estimatedMinutes,
				goalId: input.goalId,
				ownerId,
				priority: input.priority,
				projectId: input.projectId,
				rule: input.rule,
				startDate: input.startDate,
				tags: { create: input.tagIds.map(tagId => ({ tagId })) },
				title: input.title,
			},
			select: { id: true },
		});
		await materialize(tx, await loadRule(tx, ownerId, id), today);
		return getRecurrence(tx, ownerId, id);
	});

/**
 * "This and following": only future `todo` occurrences are affected, past, started and finished ones never change.
 * A new `rule`, `startDate` or time (`startMinute`/`durationMinutes`) replaces those future occurrences (they are regenerated from today); template changes
 * (title, priority, tags...) are copied onto them. An update that changes nothing writes nothing.
 */
export const updateRecurrence = (prisma: PrismaClient, ownerId: string, id: string, { tagIds, ...fields }: UpdateRecurrenceInput, today: Date): Promise<RecurrenceView> =>
	prisma.$transaction(async tx => {
		const current = await loadRule(tx, ownerId, id);
		const { tagIds: newTagIds, ...changes } = changedFields({ ...current, tagIds: current.tags.map(link => link.tagId) }, { ...fields, tagIds }, { unordered: ['tagIds'] });
		if (!hasChanges(changes) && !newTagIds) return getRecurrence(tx, ownerId, id);

		await assertReferences(tx, ownerId, { goalId: changes.goalId, projectId: changes.projectId, tagIds: newTagIds });
		const startMinute = changes.startMinute === undefined ? current.startMinute : changes.startMinute;
		const durationMinutes = changes.durationMinutes === undefined ? current.durationMinutes : changes.durationMinutes;
		if ((startMinute == null) !== (durationMinutes == null)) throw new AppError('validation_error', 422, [{ code: 'time_requires_duration', field: 'durationMinutes' }]);
		const scheduleChanged = changes.rule !== undefined || changes.startDate !== undefined || changes.startMinute !== undefined || changes.durationMinutes !== undefined;

		if (hasChanges(changes)) await tx.recurrenceRule.updateMany({ data: { ...changes, ...(scheduleChanged && { generatedUntil: null }) }, where: scoped(ownerId, { id }) });
		if (newTagIds) {
			await tx.recurrenceRuleTag.deleteMany({ where: { recurrenceRuleId: id } });
			await tx.recurrenceRuleTag.createMany({ data: newTagIds.map(tagId => ({ recurrenceRuleId: id, tagId })) });
		}

		if (scheduleChanged) {
			await tx.task.deleteMany({ where: untouchedFuture(ownerId, id, today) });
			await materialize(tx, await loadRule(tx, ownerId, id), today);
		} else {
			const { rule: _rule, startDate: _startDate, startMinute: _startMinute, durationMinutes: _durationMinutes, ...template } = changes;
			const future = await tx.task.findMany({ select: { id: true }, where: untouchedFuture(ownerId, id, today) });
			const taskIds = future.map(task => task.id);
			if (hasChanges(template) && taskIds.length > 0) await tx.task.updateMany({ data: template, where: scoped(ownerId, { id: { in: taskIds } }) });
			if (newTagIds && taskIds.length > 0) {
				await tx.taskTag.deleteMany({ where: { taskId: { in: taskIds } } });
				await tx.taskTag.createMany({ data: taskIds.flatMap(taskId => newTagIds.map(tagId => ({ tagId, taskId }))) });
			}
		}
		return getRecurrence(tx, ownerId, id);
	});

/** Deletes the rule and its future untouched occurrences. Past, started and finished tasks stay (they only lose the link to the rule). */
export const deleteRecurrence = (prisma: PrismaClient, ownerId: string, id: string, today: Date): Promise<void> =>
	prisma.$transaction(async tx => {
		await loadRule(tx, ownerId, id);
		await tx.task.deleteMany({ where: untouchedFuture(ownerId, id, today) });
		await tx.recurrenceRule.deleteMany({ where: scoped(ownerId, { id }) });
	});

/** Generates the occurrences missing up to `today + WINDOW_DAYS`. Idempotent: safe to call on every app open or from a scheduler. */
export const materializeRecurrence = (prisma: PrismaClient, ownerId: string, id: string, today: Date): Promise<RecurrenceView> =>
	prisma.$transaction(async tx => {
		await materialize(tx, await loadRule(tx, ownerId, id), today);
		return getRecurrence(tx, ownerId, id);
	});

/**
 * Called by the tasks service when an occurrence is completed or cancelled: makes sure the next occurrence exists, even beyond the
 * window (monthly/yearly rules). Does nothing when it was already generated or the rule has ended.
 */
export const createNextOccurrence = async (tx: Db, ownerId: string, recurrenceId: string, after: Date): Promise<void> => {
	const rule = await tx.recurrenceRule.findFirst({ include: withTagIds, where: scoped(ownerId, { id: recurrenceId }) });
	if (!rule) return;
	const next = expand(rule).after(after, false);
	if (!next || (rule.generatedUntil && next <= rule.generatedUntil)) return;
	await createOccurrences(tx, rule, [next]);
	await tx.recurrenceRule.updateMany({ data: { generatedUntil: next }, where: scoped(ownerId, { id: rule.id }) });
};
