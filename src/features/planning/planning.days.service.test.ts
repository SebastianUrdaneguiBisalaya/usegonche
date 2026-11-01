import { describe, expect, it, vi } from 'vitest';
import { createMockPrisma, OTHER_USER_ID, TEST_USER_ID } from '../../test/helpers.js';
import { getDay, setDayItems } from './planning.days.service.js';

const DATE = '2026-11-02'; // Monday
const T1 = '5d1f0c2e-7a34-4b9e-8c61-2f3a4b5c6d7e';
const T2 = '9b7e4a10-3c52-4d8f-a1e6-0f2d3c4b5a69';
const T3 = 'c4d5e6f7-1a2b-4c3d-8e9f-a0b1c2d3e4f5';
const monday9to5 = [{ endMinute: 1020, startMinute: 540, weekday: 1 }];
const task = (id: string, status: string, estimatedMinutes: number | null) => ({ dueDate: null, estimatedMinutes, id, priority: 'medium', status, title: id });

// biome-ignore lint/suspicious/noExplicitAny: the mock rows are partial on purpose
const asRow = (value: unknown): any => value;
const rejection = (promise: Promise<unknown>) =>
	promise.then(
		() => null,
		(e: unknown) => e
	);

const setup = ({ events = [], items = [], windows = monday9to5, blocks = [] }: { blocks?: unknown[]; events?: unknown[]; items?: unknown[]; windows?: unknown[] } = {}) => {
	const prisma = createMockPrisma();
	vi.mocked(prisma.availabilityWindow.findMany).mockResolvedValue(asRow(windows));
	vi.mocked(prisma.calendarEvent.findMany).mockResolvedValue(asRow(events));
	vi.mocked(prisma.timeBlock.findMany).mockResolvedValueOnce(asRow(blocks)).mockResolvedValue([]);
	vi.mocked(prisma.dailyPlan.findFirst).mockResolvedValue(asRow(items.length ? { items } : null));
	return prisma;
};

describe('getDay', () => {
	it('summarizes capacity: working hours minus timed events vs open planned estimates', async () => {
		const prisma = setup({
			events: [{ allDay: false, endsAt: new Date('2026-11-02T11:00:00Z'), kind: 'event', startsAt: new Date('2026-11-02T10:00:00Z') }],
			items: [
				{ id: 'i1', position: 0, task: task(T1, 'todo', 60) },
				{ id: 'i2', position: 1, task: task(T2, 'in_progress', null) },
				{ id: 'i3', position: 2, task: task(T3, 'done', 30) },
			],
		});
		const day = await getDay(prisma, TEST_USER_ID, DATE);
		expect(day.capacity).toEqual({ availableMinutes: 420, overcommitted: false, plannedMinutes: 60, remainingMinutes: 360, scheduledMinutes: 0, unestimatedTasks: 1, workingMinutes: 480 });
		expect(day.items.map(item => item.task.id)).toEqual([T1, T2, T3]);
		expect(day.timezone).toBe('UTC');
	});

	it('flags overcommitment and an out-of-office day leaves no availability', async () => {
		const prisma = setup({
			events: [{ allDay: true, endsAt: new Date('2026-11-03T00:00:00Z'), kind: 'out_of_office', startsAt: new Date('2026-11-02T00:00:00Z') }],
			items: [{ id: 'i1', position: 0, task: task(T1, 'todo', 60) }],
		});
		const { capacity } = await getDay(prisma, TEST_USER_ID, DATE);
		expect(capacity).toMatchObject({ availableMinutes: 0, overcommitted: true, remainingMinutes: -60, workingMinutes: 480 });
	});

	it('does not reduce availability for a plain all-day event', async () => {
		const prisma = setup({ events: [{ allDay: true, endsAt: new Date('2026-11-03T00:00:00Z'), kind: 'event', startsAt: new Date('2026-11-02T00:00:00Z') }] });
		expect((await getDay(prisma, TEST_USER_ID, DATE)).capacity.availableMinutes).toBe(480);
	});

	it('has no capacity on a weekday without windows and works without a plan', async () => {
		const prisma = setup({ windows: [] });
		const day = await getDay(prisma, TEST_USER_ID, DATE);
		expect(day.items).toEqual([]);
		expect(day.capacity).toMatchObject({ availableMinutes: 0, plannedMinutes: 0, overcommitted: false, workingMinutes: 0 });
	});

	it('counts planned time blocks within the day and attaches warnings to them', async () => {
		const block = { id: 'b1', plannedEnd: new Date('2026-11-02T12:00:00Z'), plannedStart: new Date('2026-11-02T10:00:00Z'), status: 'planned' };
		const done = { ...block, id: 'b2', status: 'done' };
		const prisma = setup({ blocks: [block, done] });
		const day = await getDay(prisma, TEST_USER_ID, DATE);
		expect(day.capacity.scheduledMinutes).toBe(120);
		expect(day.blocks.map(b => [b.id, b.warnings])).toEqual([
			['b1', []],
			['b2', []],
		]);
	});

	it('scopes every query by owner and uses the plan of that local date', async () => {
		const prisma = setup();
		await getDay(prisma, OTHER_USER_ID, DATE);
		expect(prisma.dailyPlan.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { date: new Date(DATE), ownerId: OTHER_USER_ID } }));
		expect(prisma.availabilityWindow.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerId: OTHER_USER_ID } }));
	});
});

describe('setDayItems', () => {
	const setupSet = (existing: { taskId: string }[] = []) => {
		const prisma = setup();
		vi.mocked(prisma.dailyPlan.upsert).mockResolvedValue(asRow({ id: 'plan', items: existing }));
		return prisma;
	};

	it('stores the tasks in order', async () => {
		const prisma = setupSet();
		vi.mocked(prisma.task.findMany).mockResolvedValue(
			asRow([
				{ id: T1, status: 'todo' },
				{ id: T2, status: 'todo' },
			])
		);
		await setDayItems(prisma, TEST_USER_ID, DATE, [T2, T1]);
		expect(prisma.task.findMany).toHaveBeenCalledWith({ select: { id: true, status: true }, where: { id: { in: [T2, T1] }, ownerId: TEST_USER_ID } });
		expect(prisma.dailyPlan.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerId_date: { date: new Date(DATE), ownerId: TEST_USER_ID } } }));
		expect(prisma.dailyPlanItem.deleteMany).toHaveBeenCalledWith({ where: { ownerId: TEST_USER_ID, planId: 'plan' } });
		expect(prisma.dailyPlanItem.createMany).toHaveBeenCalledWith({
			data: [
				{ ownerId: TEST_USER_ID, planId: 'plan', position: 0, taskId: T2 },
				{ ownerId: TEST_USER_ID, planId: 'plan', position: 1, taskId: T1 },
			],
		});
	});

	it('clears the day with an empty list', async () => {
		const prisma = setupSet();
		vi.mocked(prisma.task.findMany).mockResolvedValue([]);
		await setDayItems(prisma, TEST_USER_ID, DATE, []);
		expect(prisma.dailyPlanItem.createMany).not.toHaveBeenCalled();
	});

	it('rejects tasks that are not the owner’s with 422', async () => {
		const prisma = setupSet();
		vi.mocked(prisma.task.findMany).mockResolvedValue(asRow([{ id: T1, status: 'todo' }]));
		expect(await rejection(setDayItems(prisma, TEST_USER_ID, DATE, [T1, T2]))).toMatchObject({ details: [{ code: 'not_found', field: 'taskIds' }], status: 422 });
		expect(prisma.dailyPlanItem.deleteMany).not.toHaveBeenCalled();
	});

	it('rejects adding a done or cancelled task but keeps one already in the plan', async () => {
		const prisma = setupSet([{ taskId: T2 }]);
		vi.mocked(prisma.task.findMany).mockResolvedValue(asRow([{ id: T1, status: 'cancelled' }]));
		expect(await rejection(setDayItems(prisma, TEST_USER_ID, DATE, [T1]))).toMatchObject({ details: [{ code: 'task_closed', field: 'taskIds' }], status: 422 });

		vi.mocked(prisma.task.findMany).mockResolvedValue(asRow([{ id: T2, status: 'done' }]));
		await setDayItems(prisma, TEST_USER_ID, DATE, [T2]);
		expect(prisma.dailyPlanItem.createMany).toHaveBeenCalled();
	});
});
