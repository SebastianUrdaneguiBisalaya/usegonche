import type { Prisma, PrismaClient, Tag, Template, TemplateKind } from '@usegonche/database';
import { changedFields, hasChanges, valuesEqual } from '../../lib/diff.js';
import { AppError } from '../../lib/errors.js';
import { scoped } from '../../lib/owner.js';
import { type Cursor, keysetAfter, keysetOrder } from '../../lib/pagination.js';
import type { CreateTemplateInput, InstantiateTemplateInput, TemplateItemInput, UpdateTemplateInput } from './templates.schemas.js';

type Db = PrismaClient | Prisma.TransactionClient;
type Priority = 'low' | 'medium' | 'high' | 'urgent';

export type TemplateSubtaskView = { description: string | null; dueOffsetDays: number | null; estimatedMinutes: number | null; id: string; priority: Priority; tags: Tag[]; title: string };
export type TemplateItemView = TemplateSubtaskView & { subtasks: TemplateSubtaskView[] };
export type TemplateView = Template & { items: TemplateItemView[]; tags: Tag[] };
/** What `instantiate` created: the project (project templates) and every task and subtask, tasks first in template order. */
export type InstantiateResult = { projectId: string | null; taskIds: string[] };

const DAY_MS = 86_400_000;
const tagsInclude = { include: { tag: true }, orderBy: { tag: { name: 'asc' as const } } };
const include = { items: { include: { tags: tagsInclude }, orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }] }, tags: tagsInclude };

type ItemRow = {
	description: string | null;
	dueOffsetDays: number | null;
	estimatedMinutes: number | null;
	id: string;
	parentId: string | null;
	priority: Priority;
	tags: { tag: Tag }[];
	title: string;
};
type Row = Template & { items: ItemRow[]; tags: { tag: Tag }[] };

const toSubtask = ({ tags, parentId: _parentId, ...item }: ItemRow): TemplateSubtaskView => ({ ...item, tags: tags.map(link => link.tag) });

const toView = ({ items, tags, ...template }: Row): TemplateView => ({
	...template,
	items: items.filter(item => !item.parentId).map(item => ({ ...toSubtask(item), subtasks: items.filter(sub => sub.parentId === item.id).map(toSubtask) })),
	tags: tags.map(link => link.tag),
});

const invalid = (field: string, code: string): AppError => new AppError('validation_error', 422, [{ code, field }]);

const assertProject = async (prisma: Db, ownerId: string, projectId: string): Promise<void> => {
	if (!(await prisma.project.findFirst({ select: { id: true }, where: scoped(ownerId, { id: projectId }) }))) throw invalid('projectId', 'not_found');
};

const assertGoal = async (prisma: Db, ownerId: string, goalId: string): Promise<void> => {
	if (!(await prisma.goal.findFirst({ select: { id: true }, where: scoped(ownerId, { id: goalId }) }))) throw invalid('goalId', 'not_found');
};

const assertTags = async (prisma: Db, ownerId: string, ids: string[]): Promise<void> => {
	const unique = [...new Set(ids)];
	if (unique.length > 0 && (await prisma.tag.count({ where: scoped(ownerId, { id: { in: unique } }) })) !== unique.length) throw invalid('tagIds', 'not_found');
};

const itemTagIds = (items: TemplateItemInput[]): string[] => items.flatMap(item => [...item.tagIds, ...item.subtasks.flatMap(sub => sub.tagIds)]);

const writeItems = async (tx: Db, ownerId: string, templateId: string, items: TemplateItemInput[]): Promise<void> => {
	const data = ({ subtasks: _subtasks, tagIds, ...item }: TemplateItemInput & { subtasks?: unknown }, position: number, parentId?: string) => ({
		description: item.description,
		dueOffsetDays: item.dueOffsetDays,
		estimatedMinutes: item.estimatedMinutes,
		ownerId,
		parentId,
		position,
		priority: item.priority,
		tags: { create: tagIds.map(tagId => ({ tagId })) },
		templateId,
		title: item.title,
	});
	for (const [index, item] of items.entries()) {
		const { id } = await tx.templateItem.create({ data: data(item, index), select: { id: true } });
		for (const [subIndex, sub] of item.subtasks.entries()) await tx.templateItem.create({ data: data({ ...sub, subtasks: [] }, subIndex, id) });
	}
};

/** The stored structure in the shape of the write input (tag sets sorted), to detect updates that change nothing. */
const normalize = (
	items: { description?: string | null; dueOffsetDays?: number | null; estimatedMinutes?: number | null; priority: string; subtasks: unknown[]; tagIds: string[]; title: string }[]
): unknown => items.map(({ subtasks, tagIds, ...item }) => ({ ...item, subtasks: normalize(subtasks as never), tagIds: [...tagIds].sort() }));

const asInput = (item: TemplateSubtaskView & { subtasks?: TemplateSubtaskView[] }): TemplateItemInput => ({
	description: item.description,
	dueOffsetDays: item.dueOffsetDays,
	estimatedMinutes: item.estimatedMinutes,
	priority: item.priority,
	subtasks: (item.subtasks ?? []).map(sub => ({ ...asInput(sub), subtasks: [] })),
	tagIds: item.tags.map(tag => tag.id),
	title: item.title,
});

export const getTemplate = async (prisma: Db, ownerId: string, id: string): Promise<TemplateView> => {
	const row = await prisma.template.findFirst({ include, where: scoped(ownerId, { id }) });
	if (!row) throw new AppError('not_found', 404);
	return toView(row as Row);
};

/** Fetches `limit + 1` templates (without their items) after `cursor`, newest first; pass them to `toPage`. */
export const listTemplates = (prisma: PrismaClient, ownerId: string, kind: TemplateKind | undefined, limit: number, cursor?: Cursor): Promise<Template[]> =>
	prisma.template.findMany({ orderBy: keysetOrder('createdAt'), take: limit + 1, where: { ...scoped(ownerId, kind && { kind }), ...keysetAfter('createdAt', cursor) } });

export const createTemplate = (prisma: PrismaClient, ownerId: string, input: CreateTemplateInput): Promise<TemplateView> =>
	prisma.$transaction(async tx => {
		const items = input.kind === 'task' ? [input.item] : input.items;
		await assertTags(tx, ownerId, [...(input.kind === 'project' ? input.tagIds : []), ...itemTagIds(items)]);
		const { id } = await tx.template.create({
			data: {
				description: input.kind === 'project' ? input.description : undefined,
				kind: input.kind,
				name: input.name,
				ownerId,
				tags: { create: input.kind === 'project' ? input.tagIds.map(tagId => ({ tagId })) : [] },
				title: input.kind === 'project' ? input.title : undefined,
			},
			select: { id: true },
		});
		await writeItems(tx, ownerId, id, items);
		return getTemplate(tx, ownerId, id);
	});

/**
 * Changes only what differs: an update that changes nothing answers with the current template and writes nothing.
 * Sending `item`/`items` replaces the whole structure (when it differs). `title`, `description`, `tagIds` and `items` apply to
 * project templates, `item` to task templates (422 `not_applicable` otherwise).
 */
export const updateTemplate = (prisma: PrismaClient, ownerId: string, id: string, { item, items, tagIds, ...fields }: UpdateTemplateInput): Promise<TemplateView> =>
	prisma.$transaction(async tx => {
		const current = await getTemplate(tx, ownerId, id);
		const isTask = current.kind === 'task';
		const projectOnly = { description: fields.description, items, tagIds, title: fields.title };
		for (const [field, value] of Object.entries(projectOnly)) if (isTask && value !== undefined) throw invalid(field, 'not_applicable');
		if (!isTask && item !== undefined) throw invalid('item', 'not_applicable');

		const changes = changedFields({ ...current, tagIds: current.tags.map(tag => tag.id) }, { ...fields, tagIds }, { unordered: ['tagIds'] });
		const { tagIds: newTagIds, ...columns } = changes;
		const nextItems = isTask ? item && [item] : items;
		const itemsChanged = nextItems !== undefined && !valuesEqual(normalize(nextItems), normalize(current.items.map(asInput)));
		if (!hasChanges(columns) && !newTagIds && !itemsChanged) return current;

		await assertTags(tx, ownerId, [...(newTagIds ?? []), ...(itemsChanged && nextItems ? itemTagIds(nextItems) : [])]);
		if (hasChanges(columns)) await tx.template.updateMany({ data: columns, where: scoped(ownerId, { id }) });
		if (newTagIds) {
			await tx.templateTag.deleteMany({ where: { templateId: id } });
			await tx.templateTag.createMany({ data: newTagIds.map(tagId => ({ tagId, templateId: id })) });
		}
		if (itemsChanged && nextItems) {
			await tx.templateItem.deleteMany({ where: scoped(ownerId, { templateId: id }) });
			await writeItems(tx, ownerId, id, nextItems);
		}
		return getTemplate(tx, ownerId, id);
	});

export const deleteTemplate = async (prisma: PrismaClient, ownerId: string, id: string): Promise<void> => {
	const { count } = await prisma.template.deleteMany({ where: scoped(ownerId, { id }) });
	if (count === 0) throw new AppError('not_found', 404);
};

type TaskContext = { dueFrom: Date | null; goalId: string | null; parentId: string | null; projectId: string | null };

const createTask = async (tx: Db, ownerId: string, item: TemplateSubtaskView, context: TaskContext, title: string): Promise<string> => {
	const { id } = await tx.task.create({
		data: {
			description: item.description,
			dueDate: item.dueOffsetDays != null && context.dueFrom ? new Date(context.dueFrom.getTime() + item.dueOffsetDays * DAY_MS) : undefined,
			estimatedMinutes: item.estimatedMinutes,
			goalId: context.goalId,
			origin: 'template',
			ownerId,
			parentId: context.parentId,
			priority: item.priority,
			projectId: context.projectId,
			tags: { create: item.tags.map(tag => ({ tagId: tag.id })) },
			title,
		},
		select: { id: true },
	});
	return id;
};

/**
 * Copies the template into real data in one transaction: a task with its subtasks (task templates) or a project with its tasks and
 * subtasks (project templates). Created tasks have origin `template` and nothing links back to the template. Offsets become due dates
 * counted from `startDate`, which is required when the template has any.
 */
export const instantiateTemplate = (prisma: PrismaClient, ownerId: string, id: string, input: InstantiateTemplateInput): Promise<InstantiateResult> =>
	prisma.$transaction(async tx => {
		const template = await getTemplate(tx, ownerId, id);
		const isTask = template.kind === 'task';
		if (!isTask && input.projectId) throw invalid('projectId', 'not_applicable');
		if (input.projectId) await assertProject(tx, ownerId, input.projectId);
		if (input.goalId) await assertGoal(tx, ownerId, input.goalId);
		const hasOffsets = template.items.some(item => item.dueOffsetDays != null || item.subtasks.some(sub => sub.dueOffsetDays != null));
		if (hasOffsets && !input.startDate) throw invalid('startDate', 'start_date_required');

		let projectId = input.projectId ?? null;
		if (!isTask) {
			const project = await tx.project.create({
				data: {
					description: template.description,
					goalId: input.goalId,
					ownerId,
					tags: { create: template.tags.map(tag => ({ tagId: tag.id })) },
					title: input.title ?? template.title ?? template.name,
				},
				select: { id: true },
			});
			projectId = project.id;
		}

		const context: TaskContext = { dueFrom: input.startDate ?? null, goalId: isTask ? (input.goalId ?? null) : null, parentId: null, projectId };
		const taskIds: string[] = [];
		const subtaskIds: string[] = [];
		for (const item of template.items) {
			const taskId = await createTask(tx, ownerId, item, context, isTask ? (input.title ?? item.title) : item.title);
			taskIds.push(taskId);
			for (const sub of item.subtasks) subtaskIds.push(await createTask(tx, ownerId, sub, { ...context, parentId: taskId }, sub.title));
		}
		return { projectId, taskIds: [...taskIds, ...subtaskIds] };
	});
