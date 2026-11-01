import { describe, expect, it, vi } from 'vitest';
import { createMockPrisma, OTHER_USER_ID, TEST_USER_ID } from '../../test/helpers.js';
import { createNextOccurrence, createRecurrence, deleteRecurrence, getRecurrence, getToday, listRecurrences, materializeRecurrence, updateRecurrence } from './recurrences.service.js';

const ID = '5d1f0c2e-7a34-4b9e-8c61-2f3a4b5c6d7e';
const TAG_ID = 'c4d5e6f7-1a2b-4c3d-8e9f-a0b1c2d3e4f5';
const REF_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const tag = { id: TAG_ID, name: 'work' };
const TODAY = new Date('2026-11-02T00:00:00Z');
const day = (date: string) => new Date(`${date}T00:00:00Z`);
const rule = {
	createdAt: new Date('2026-11-01T10:00:00Z'),
	description: null,
	estimatedMinutes: 30,
	generatedUntil: null,
	goalId: null,
	id: ID,
	ownerId: TEST_USER_ID,
	priority: 'medium',
	projectId: null,
	rule: 'FREQ=WEEKLY;BYDAY=MO',
	startDate: day('2026-11-02'),
	tags: [{ tag, tagId: TAG_ID }],
	title: 'Weekly review',
};
const input = { priority: 'medium' as const, rule: rule.rule, startDate: rule.startDate, tagIds: [], title: 'Weekly review' };

// biome-ignore lint/suspicious/noExplicitAny: the mock rows are partial on purpose
const asRow = (value: unknown): any => value;
const rejection = (promise: Promise<unknown>) =>
	promise.then(
		() => null,
		(e: unknown) => e
	);

const setup = (row: unknown = rule) => {
	const prisma = createMockPrisma();
	vi.mocked(prisma.recurrenceRule.findFirst).mockResolvedValue(asRow(row));
	vi.mocked(prisma.task.findMany).mockResolvedValue([]);
	vi.mocked(prisma.task.create).mockResolvedValue(asRow({ id: 'task-1' }));
	return prisma;
};
const createdDates = (prisma: ReturnType<typeof createMockPrisma>) =>
	vi.mocked(prisma.task.create).mock.calls.map(call => (call[0] as { data: { occurrenceDate: Date } }).data.occurrenceDate.toISOString().slice(0, 10));

describe('getToday', () => {
	it('uses the timezone of the user settings', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.userSettings.findUnique).mockResolvedValue(asRow({ timezone: 'Pacific/Auckland' }));
		expect(await getToday(prisma, TEST_USER_ID, new Date('2026-11-01T20:00:00Z'))).toEqual(day('2026-11-02'));
	});

	it('falls back to UTC', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.userSettings.findUnique).mockResolvedValue(null);
		expect(await getToday(prisma, TEST_USER_ID, new Date('2026-11-01T20:00:00Z'))).toEqual(day('2026-11-01'));
	});
});

describe('getRecurrence / listRecurrences', () => {
	it('flattens the tags and scopes by owner', async () => {
		const prisma = setup();
		expect(await getRecurrence(prisma, TEST_USER_ID, ID)).toMatchObject({ id: ID, tags: [tag] });
		expect(vi.mocked(prisma.recurrenceRule.findFirst).mock.calls[0]?.[0]?.where).toEqual({ id: ID, ownerId: TEST_USER_ID });
	});

	it('throws 404 for another owner', async () => {
		const prisma = setup(null);
		expect(await rejection(getRecurrence(prisma, OTHER_USER_ID, ID))).toMatchObject({ code: 'not_found', status: 404 });
	});

	it('lists with keyset pagination scoped by owner', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.recurrenceRule.findMany).mockResolvedValue(asRow([rule]));
		expect(await listRecurrences(prisma, TEST_USER_ID, 20)).toHaveLength(1);
		expect(prisma.recurrenceRule.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 21, where: { ownerId: TEST_USER_ID } }));
	});
});

describe('createRecurrence', () => {
	it('creates the rule and the occurrences from today to the 14-day window', async () => {
		const prisma = setup();
		vi.mocked(prisma.recurrenceRule.create).mockResolvedValue(asRow({ id: ID }));
		await createRecurrence(prisma, TEST_USER_ID, input, TODAY);
		expect(createdDates(prisma)).toEqual(['2026-11-02', '2026-11-09', '2026-11-16']);
		expect(prisma.recurrenceRule.updateMany).toHaveBeenCalledWith({ data: { generatedUntil: day('2026-11-16') }, where: { id: ID, ownerId: TEST_USER_ID } });
		expect(vi.mocked(prisma.recurrenceRule.create).mock.calls[0]?.[0]?.data).toMatchObject({ ownerId: TEST_USER_ID, rule: rule.rule });
	});

	it('copies the template into every occurrence, due on its day, with the tags', async () => {
		const prisma = setup();
		vi.mocked(prisma.recurrenceRule.create).mockResolvedValue(asRow({ id: ID }));
		await createRecurrence(prisma, TEST_USER_ID, input, TODAY);
		expect(vi.mocked(prisma.task.create).mock.calls[0]?.[0]?.data).toMatchObject({
			dueDate: day('2026-11-02'),
			occurrenceDate: day('2026-11-02'),
			ownerId: TEST_USER_ID,
			recurrenceId: ID,
			tags: { create: [{ tagId: TAG_ID }] },
			title: 'Weekly review',
		});
	});

	it('does not backfill the past and waits for a future start date', async () => {
		const prisma = setup({ ...rule, startDate: day('2027-03-01') });
		vi.mocked(prisma.recurrenceRule.create).mockResolvedValue(asRow({ id: ID }));
		await createRecurrence(prisma, TEST_USER_ID, { ...input, startDate: day('2027-03-01') }, TODAY);
		expect(prisma.task.create).not.toHaveBeenCalled();
	});

	it.each([
		['projectId', (p: ReturnType<typeof createMockPrisma>) => vi.mocked(p.project.findFirst).mockResolvedValue(null)],
		['goalId', (p: ReturnType<typeof createMockPrisma>) => vi.mocked(p.goal.findFirst).mockResolvedValue(null)],
		['tagIds', (p: ReturnType<typeof createMockPrisma>) => vi.mocked(p.tag.count).mockResolvedValue(0)],
	] as const)("rejects a %s that is not the owner's with 422", async (field, arrange) => {
		const prisma = setup();
		arrange(prisma);
		const refs = { goalId: REF_ID, projectId: REF_ID, tagIds: [TAG_ID] };
		const body = { ...input, [field]: refs[field] };
		expect(await rejection(createRecurrence(prisma, TEST_USER_ID, body, TODAY))).toMatchObject({ code: 'validation_error', details: [{ code: 'not_found', field }], status: 422 });
		expect(prisma.recurrenceRule.create).not.toHaveBeenCalled();
	});
});

describe('time of day', () => {
	const timed = { ...rule, durationMinutes: 30, rule: 'FREQ=DAILY', startMinute: 540 };

	it('plans a time block on each occurrence at the local time of the user timezone', async () => {
		const prisma = setup({ ...timed, generatedUntil: day('2026-11-02') });
		vi.mocked(prisma.userSettings.findUnique).mockResolvedValue(asRow({ timezone: 'America/Lima' }));
		vi.mocked(prisma.task.create).mockResolvedValue(asRow({ id: 'task-1' }));
		await materializeRecurrence(prisma, TEST_USER_ID, ID, day('2026-11-03'));
		expect(vi.mocked(prisma.timeBlock.create).mock.calls[0]?.[0]?.data).toEqual({
			ownerId: TEST_USER_ID,
			plannedEnd: new Date('2026-11-03T14:30:00Z'),
			plannedStart: new Date('2026-11-03T14:00:00Z'),
			taskId: 'task-1',
		});
	});

	it('creates no time block without a time of day', async () => {
		const prisma = setup();
		await materializeRecurrence(prisma, TEST_USER_ID, ID, TODAY);
		expect(prisma.timeBlock.create).not.toHaveBeenCalled();
	});

	it('regenerates future occurrences when the time changes', async () => {
		const prisma = setup(timed);
		await updateRecurrence(prisma, TEST_USER_ID, ID, { startMinute: 600 }, TODAY);
		expect(prisma.recurrenceRule.updateMany).toHaveBeenCalledWith({ data: { generatedUntil: null, startMinute: 600 }, where: { id: ID, ownerId: TEST_USER_ID } });
		expect(prisma.task.deleteMany).toHaveBeenCalled();
	});

	it('rejects a time without duration (and clearing only one of them) with 422', async () => {
		expect(await rejection(updateRecurrence(setup(), TEST_USER_ID, ID, { startMinute: 540 }, TODAY))).toMatchObject({
			details: [{ code: 'time_requires_duration', field: 'durationMinutes' }],
			status: 422,
		});
		expect(await rejection(updateRecurrence(setup(timed), TEST_USER_ID, ID, { durationMinutes: null }, TODAY))).toMatchObject({ status: 422 });
	});

	it('clears the time of day together with the duration', async () => {
		const prisma = setup(timed);
		await updateRecurrence(prisma, TEST_USER_ID, ID, { durationMinutes: null, startMinute: null }, TODAY);
		expect(prisma.recurrenceRule.updateMany).toHaveBeenCalledWith({ data: { durationMinutes: null, generatedUntil: null, startMinute: null }, where: { id: ID, ownerId: TEST_USER_ID } });
	});
});

describe('materializeRecurrence', () => {
	it('only creates what is missing and never revisits examined days', async () => {
		const prisma = setup({ ...rule, generatedUntil: day('2026-11-10') });
		await materializeRecurrence(prisma, TEST_USER_ID, ID, TODAY);
		expect(createdDates(prisma)).toEqual(['2026-11-16']);
	});

	it('does nothing when the window is already generated', async () => {
		const prisma = setup({ ...rule, generatedUntil: day('2026-11-16') });
		await materializeRecurrence(prisma, TEST_USER_ID, ID, TODAY);
		expect(prisma.task.create).not.toHaveBeenCalled();
		expect(prisma.recurrenceRule.updateMany).not.toHaveBeenCalled();
	});

	it('skips occurrences that already exist (idempotent)', async () => {
		const prisma = setup();
		vi.mocked(prisma.task.findMany).mockResolvedValue(asRow([{ occurrenceDate: day('2026-11-02') }]));
		await materializeRecurrence(prisma, TEST_USER_ID, ID, TODAY);
		expect(createdDates(prisma)).toEqual(['2026-11-09', '2026-11-16']);
	});

	it('throws 404 for another owner', async () => {
		const prisma = setup(null);
		expect(await rejection(materializeRecurrence(prisma, OTHER_USER_ID, ID, TODAY))).toMatchObject({ code: 'not_found', status: 404 });
	});

	it('answers 409 when the stored rule is no longer valid', async () => {
		const prisma = setup({ ...rule, rule: 'FREQ=HOURLY' });
		expect(await rejection(materializeRecurrence(prisma, TEST_USER_ID, ID, TODAY))).toMatchObject({ code: 'invalid_state', status: 409 });
	});
});

describe('updateRecurrence', () => {
	it('writes nothing when the payload changes nothing', async () => {
		const prisma = setup();
		await updateRecurrence(prisma, TEST_USER_ID, ID, { tagIds: [TAG_ID], title: 'Weekly review' }, TODAY);
		expect(prisma.recurrenceRule.updateMany).not.toHaveBeenCalled();
		expect(prisma.task.deleteMany).not.toHaveBeenCalled();
		expect(prisma.task.updateMany).not.toHaveBeenCalled();
	});

	it('replaces future untouched occurrences when the schedule changes', async () => {
		const prisma = setup();
		await updateRecurrence(prisma, TEST_USER_ID, ID, { rule: 'FREQ=WEEKLY;BYDAY=TU' }, TODAY);
		expect(prisma.recurrenceRule.updateMany).toHaveBeenCalledWith({ data: { generatedUntil: null, rule: 'FREQ=WEEKLY;BYDAY=TU' }, where: { id: ID, ownerId: TEST_USER_ID } });
		expect(prisma.task.deleteMany).toHaveBeenCalledWith({
			where: {
				attachments: { none: {} },
				occurrenceDate: { gte: TODAY },
				ownerId: TEST_USER_ID,
				recurrenceId: ID,
				status: 'todo',
				timeBlocks: { none: { NOT: { rescheduledFromId: null, status: 'planned' } } },
			},
		});
		expect(prisma.recurrenceRule.updateMany).toHaveBeenCalledTimes(2);
	});

	it('copies template changes onto future untouched occurrences only', async () => {
		const prisma = setup();
		vi.mocked(prisma.task.findMany).mockResolvedValue(asRow([{ id: 'a' }, { id: 'b' }]));
		await updateRecurrence(prisma, TEST_USER_ID, ID, { priority: 'high', title: 'New' }, TODAY);
		expect(prisma.task.deleteMany).not.toHaveBeenCalled();
		expect(prisma.task.updateMany).toHaveBeenCalledWith({ data: { priority: 'high', title: 'New' }, where: { id: { in: ['a', 'b'] }, ownerId: TEST_USER_ID } });
	});

	it('replaces the tags of the rule and of the future occurrences', async () => {
		const prisma = setup();
		vi.mocked(prisma.tag.count).mockResolvedValue(1);
		vi.mocked(prisma.task.findMany).mockResolvedValue(asRow([{ id: 'a' }]));
		await updateRecurrence(prisma, TEST_USER_ID, ID, { tagIds: [REF_ID] }, TODAY);
		expect(prisma.recurrenceRuleTag.createMany).toHaveBeenCalledWith({ data: [{ recurrenceRuleId: ID, tagId: REF_ID }] });
		expect(prisma.taskTag.createMany).toHaveBeenCalledWith({ data: [{ tagId: REF_ID, taskId: 'a' }] });
	});

	it("rejects a project that is not the owner's and throws 404 for another owner", async () => {
		const prisma = setup();
		vi.mocked(prisma.project.findFirst).mockResolvedValue(null);
		expect(await rejection(updateRecurrence(prisma, TEST_USER_ID, ID, { projectId: REF_ID }, TODAY))).toMatchObject({ code: 'validation_error', status: 422 });
		expect(await rejection(updateRecurrence(setup(null), OTHER_USER_ID, ID, { title: 'x' }, TODAY))).toMatchObject({ code: 'not_found', status: 404 });
	});
});

describe('deleteRecurrence', () => {
	it('deletes the rule and only the future untouched occurrences, scoped by owner', async () => {
		const prisma = setup();
		await deleteRecurrence(prisma, TEST_USER_ID, ID, TODAY);
		expect(prisma.task.deleteMany).toHaveBeenCalledWith({ where: expect.objectContaining({ ownerId: TEST_USER_ID, recurrenceId: ID, status: 'todo' }) });
		expect(prisma.recurrenceRule.deleteMany).toHaveBeenCalledWith({ where: { id: ID, ownerId: TEST_USER_ID } });
	});

	it('throws 404 for another owner without deleting anything', async () => {
		const prisma = setup(null);
		expect(await rejection(deleteRecurrence(prisma, OTHER_USER_ID, ID, TODAY))).toMatchObject({ code: 'not_found', status: 404 });
		expect(prisma.task.deleteMany).not.toHaveBeenCalled();
	});
});

describe('createNextOccurrence', () => {
	it('creates the next occurrence beyond the window and advances generatedUntil', async () => {
		const prisma = setup({ ...rule, generatedUntil: day('2026-11-16'), rule: 'FREQ=MONTHLY;BYMONTHDAY=1', startDate: day('2026-11-01') });
		await createNextOccurrence(prisma, TEST_USER_ID, ID, day('2026-11-01'));
		expect(createdDates(prisma)).toEqual(['2026-12-01']);
		expect(prisma.recurrenceRule.updateMany).toHaveBeenCalledWith({ data: { generatedUntil: day('2026-12-01') }, where: { id: ID, ownerId: TEST_USER_ID } });
	});

	it('does nothing when the next occurrence was already generated', async () => {
		const prisma = setup({ ...rule, generatedUntil: day('2026-11-16') });
		await createNextOccurrence(prisma, TEST_USER_ID, ID, day('2026-11-02'));
		expect(prisma.task.create).not.toHaveBeenCalled();
	});

	it('does nothing when the rule has ended or does not belong to the owner', async () => {
		const ended = setup({ ...rule, rule: 'FREQ=DAILY;COUNT=1', startDate: day('2026-11-02') });
		await createNextOccurrence(ended, TEST_USER_ID, ID, day('2026-11-02'));
		expect(ended.task.create).not.toHaveBeenCalled();
		const foreign = setup(null);
		await createNextOccurrence(foreign, OTHER_USER_ID, ID, day('2026-11-02'));
		expect(foreign.task.create).not.toHaveBeenCalled();
	});
});
