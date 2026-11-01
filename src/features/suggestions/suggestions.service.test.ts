import { describe, expect, it, vi } from 'vitest';
import { createMockPrisma, OTHER_USER_ID, TEST_USER_ID } from '../../test/helpers.js';
import { suggestNext } from './suggestions.service.js';

const NOW = new Date('2026-11-02T12:00:00Z'); // Monday, UTC
const monday9to5 = [{ endMinute: 1020, startMinute: 540, weekday: 1 }];

// biome-ignore lint/suspicious/noExplicitAny: the mock rows are partial on purpose
const asRow = (value: unknown): any => value;

const task = (id: string, extra: object = {}) => ({
	blockers: [],
	createdAt: new Date('2026-10-01T00:00:00Z'),
	dependencies: [],
	dueDate: null,
	estimatedMinutes: null,
	goal: null,
	goalId: null,
	id,
	priority: 'medium',
	project: null,
	projectId: null,
	startDate: null,
	status: 'todo',
	subtasks: [],
	title: id,
	...extra,
});

const setup = ({
	tasks = [],
	plan = [],
	windows = monday9to5,
	events = [],
	blocks = [],
}: {
	blocks?: unknown[];
	events?: unknown[];
	plan?: unknown[];
	tasks?: unknown[];
	windows?: unknown[];
} = {}) => {
	const prisma = createMockPrisma();
	vi.mocked(prisma.task.findMany).mockResolvedValue(asRow(tasks));
	vi.mocked(prisma.dailyPlanItem.findMany).mockResolvedValue(asRow(plan));
	vi.mocked(prisma.availabilityWindow.findMany).mockResolvedValue(asRow(windows));
	vi.mocked(prisma.calendarEvent.findMany).mockResolvedValue(asRow(events));
	vi.mocked(prisma.timeBlock.findMany).mockResolvedValue(asRow(blocks));
	return prisma;
};

const ids = (result: Awaited<ReturnType<typeof suggestNext>>) => result.suggestions.map(s => s.task.id);

describe('suggestNext', () => {
	it('reads only: queries open tasks of the owner and writes nothing', async () => {
		const prisma = setup({ tasks: [task('a')] });
		await suggestNext(prisma, OTHER_USER_ID, undefined, 10, NOW);
		expect(prisma.task.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerId: OTHER_USER_ID, status: { in: ['todo', 'in_progress'] } } }));
		for (const model of ['task', 'dailyPlan', 'dailyPlanItem', 'timeBlock', 'taskEvent'] as const) {
			for (const write of ['create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany'] as const) {
				expect((prisma[model] as unknown as Record<string, { mock: { calls: unknown[] } }>)[write]?.mock.calls ?? []).toHaveLength(0);
			}
		}
	});

	it('defaults the date to today in the user timezone', async () => {
		const prisma = setup();
		vi.mocked(prisma.userSettings.findUnique).mockResolvedValue({ timezone: 'Asia/Tokyo' } as never);
		expect((await suggestNext(prisma, TEST_USER_ID, undefined, 10, new Date('2026-11-02T20:00:00Z'))).date).toBe('2026-11-03');
		expect((await suggestNext(prisma, TEST_USER_ID, '2026-11-10', 10, NOW)).date).toBe('2026-11-10');
	});

	it('ranks by deadline, plan and priority with reasons', async () => {
		const prisma = setup({
			plan: [{ taskId: 'planned' }],
			tasks: [task('plain'), task('overdue', { dueDate: new Date('2026-11-01') }), task('planned'), task('urgent', { priority: 'urgent' })],
		});
		const result = await suggestNext(prisma, TEST_USER_ID, undefined, 10, NOW);
		expect(ids(result)).toEqual(['overdue', 'urgent', 'planned', 'plain']);
		expect(result.suggestions[0]?.reasons).toEqual([{ code: 'overdue', value: 1 }]);
	});

	it('excludes blocked tasks (open blocker or unfinished dependency) and counts them', async () => {
		const prisma = setup({
			tasks: [
				task('blocker', { blockers: [{ id: 'b' }] }),
				task('waiting', { dependencies: [{ dependsOn: { status: 'in_progress' } }] }),
				task('free', { dependencies: [{ dependsOn: { status: 'done' } }, { dependsOn: { status: 'cancelled' } }] }),
			],
		});
		const result = await suggestNext(prisma, TEST_USER_ID, undefined, 10, NOW);
		expect(ids(result)).toEqual(['free']);
		expect(result.excluded.blocked).toBe(2);
		expect(result.suggestions[0]?.reasons.map(r => r.code)).toContain('unblocked');
	});

	it('excludes tasks that start later and parents with open subtasks', async () => {
		const prisma = setup({
			tasks: [
				task('later', { startDate: new Date('2026-11-05') }),
				task('started', { startDate: new Date('2026-11-02') }),
				task('parent', { subtasks: [{ status: 'done' }, { status: 'todo' }] }),
				task('doneParent', { subtasks: [{ status: 'done' }] }),
			],
		});
		const result = await suggestNext(prisma, TEST_USER_ID, undefined, 10, NOW);
		expect(ids(result).sort()).toEqual(['doneParent', 'started']);
		expect(result.excluded).toEqual({ blocked: 0, notStarted: 1 });
	});

	it('computes free time from now: working hours minus events and planned blocks', async () => {
		const prisma = setup({
			blocks: [{ plannedEnd: new Date('2026-11-02T15:00:00Z'), plannedStart: new Date('2026-11-02T14:00:00Z') }],
			events: [{ allDay: false, endsAt: new Date('2026-11-02T13:00:00Z'), kind: 'event', startsAt: new Date('2026-11-02T12:30:00Z') }],
		});
		const result = await suggestNext(prisma, TEST_USER_ID, undefined, 10, NOW);
		// free: 12:00-12:30 (30), 13:00-14:00 (60), 15:00-17:00 (120)
		expect(result.freeMinutes).toBe(210);
		expect(result.largestFreeSlotMinutes).toBe(120);
	});

	it('uses the largest slot to decide which tasks fit', async () => {
		const prisma = setup({ tasks: [task('small', { estimatedMinutes: 120 }), task('big', { estimatedMinutes: 301 })] });
		const result = await suggestNext(prisma, TEST_USER_ID, undefined, 10, NOW);
		const reasons = Object.fromEntries(result.suggestions.map(s => [s.task.id, s.reasons.map(r => r.code)]));
		expect(reasons.small).toContain('fits_available_slot');
		expect(reasons.big).not.toContain('fits_available_slot');
	});

	it('has no free time outside working hours', async () => {
		const prisma = setup({ tasks: [task('a', { estimatedMinutes: 10 })], windows: [] });
		const result = await suggestNext(prisma, TEST_USER_ID, undefined, 10, NOW);
		expect(result).toMatchObject({ freeMinutes: 0, largestFreeSlotMinutes: 0 });
		expect(result.suggestions[0]?.reasons).toEqual([]);
	});

	it('links to a goal through the task or its project, only while the goal is active and not archived', async () => {
		const live = { archivedAt: null, status: 'active' };
		const prisma = setup({
			tasks: [
				task('direct', { goal: live, goalId: 'g1' }),
				task('viaProject', { project: { goal: live, goalId: 'g2' } }),
				task('archived', { goal: { archivedAt: new Date(), status: 'active' }, goalId: 'g3' }),
				task('achieved', { project: { goal: { archivedAt: null, status: 'achieved' }, goalId: 'g4' } }),
				task('none'),
			],
		});
		const result = await suggestNext(prisma, TEST_USER_ID, undefined, 10, NOW);
		const goals = Object.fromEntries(result.suggestions.map(s => [s.task.id, s.task.goalId]));
		expect(goals).toEqual({ achieved: null, archived: null, direct: 'g1', none: null, viaProject: 'g2' });
		expect(
			result.suggestions
				.filter(s => s.reasons.some(r => r.code === 'linked_to_goal'))
				.map(s => s.task.id)
				.sort()
		).toEqual(['direct', 'viaProject']);
	});

	it('respects the limit and gives an empty list without tasks', async () => {
		expect(ids(await suggestNext(setup({ tasks: [task('a'), task('b'), task('c')] }), TEST_USER_ID, undefined, 2, NOW))).toHaveLength(2);
		expect((await suggestNext(setup(), TEST_USER_ID, undefined, 10, NOW)).suggestions).toEqual([]);
	});
});
