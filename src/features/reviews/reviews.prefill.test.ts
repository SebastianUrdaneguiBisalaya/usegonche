import { describe, expect, it, vi } from 'vitest';
import { createMockPrisma, OTHER_USER_ID, TEST_USER_ID } from '../../test/helpers.js';
import { computePrefill } from './reviews.prefill.js';

const at = (iso: string) => new Date(iso);
const task = (id: string, status: string) => ({ dueDate: null, id, priority: 'medium', status, title: id });

// biome-ignore lint/suspicious/noExplicitAny: the mock rows are partial on purpose
const asRow = (value: unknown): any => value;

type Data = { blockers?: unknown[]; blocks?: unknown[]; completed?: unknown[]; events?: unknown[]; planItems?: unknown[] };
const setup = ({ planItems = [], completed = [], blocks = [], blockers = [], events = [] }: Data = {}) => {
	const prisma = createMockPrisma();
	vi.mocked(prisma.dailyPlanItem.findMany).mockResolvedValue(asRow(planItems));
	vi.mocked(prisma.task.findMany).mockResolvedValue(asRow(completed));
	vi.mocked(prisma.timeBlock.findMany).mockResolvedValue(asRow(blocks));
	vi.mocked(prisma.taskBlocker.findMany).mockResolvedValue(asRow(blockers));
	vi.mocked(prisma.taskEvent.findMany).mockResolvedValue(asRow(events));
	return prisma;
};

describe('computePrefill', () => {
	it('is all zeros for an empty period', async () => {
		const result = await computePrefill(setup(), TEST_USER_ID, '2026-11-02', '2026-11-02');
		expect(result).toEqual({
			changes: [],
			completed: [],
			counters: { actualMinutes: 0, completedTasks: 0, plannedMinutes: 0, plannedTasks: 0 },
			missedBlocks: 0,
			pending: [],
			recurringBlockers: [],
		});
	});

	it('queries the local period in the user timezone, scoped by owner', async () => {
		const prisma = setup();
		vi.mocked(prisma.userSettings.findUnique).mockResolvedValue({ timezone: 'America/Lima' } as never);
		await computePrefill(prisma, OTHER_USER_ID, '2026-11-02', '2026-11-08');
		expect(prisma.dailyPlanItem.findMany).toHaveBeenCalledWith(
			expect.objectContaining({ where: { ownerId: OTHER_USER_ID, plan: { date: { gte: new Date('2026-11-02'), lte: new Date('2026-11-08') } } } })
		);
		expect(prisma.task.findMany).toHaveBeenCalledWith(
			expect.objectContaining({ where: { completedAt: { gte: at('2026-11-02T05:00:00Z'), lt: at('2026-11-09T05:00:00Z') }, ownerId: OTHER_USER_ID } })
		);
		expect(prisma.timeBlock.findMany).toHaveBeenCalledWith(
			expect.objectContaining({ where: { ownerId: OTHER_USER_ID, plannedStart: { gte: at('2026-11-02T05:00:00Z'), lt: at('2026-11-09T05:00:00Z') }, status: { not: 'rescheduled' } } })
		);
		expect(prisma.taskEvent.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { occurredAt: { gte: at('2026-11-02T05:00:00Z'), lt: at('2026-11-09T05:00:00Z') }, ownerId: OTHER_USER_ID, type: { in: ['priority_changed', 'due_changed'] } },
			})
		);
	});

	it('separates completed from pending: pending are planned tasks still open, each counted once', async () => {
		const prisma = setup({
			completed: [task('t2', 'done'), task('t9', 'done')],
			planItems: [{ task: task('t1', 'todo') }, { task: task('t2', 'done') }, { task: task('t1', 'todo') }, { task: task('t3', 'cancelled') }, { task: task('t4', 'in_progress') }],
		});
		const result = await computePrefill(prisma, TEST_USER_ID, '2026-11-02', '2026-11-02');
		expect(result.pending.map(t => t.id)).toEqual(['t1', 't4']);
		expect(result.completed.map(t => t.id)).toEqual(['t2', 't9']);
		expect(result.counters).toMatchObject({ completedTasks: 2, plannedTasks: 4 });
	});

	it('sums planned minutes of blocks and actual minutes of the ones that really happened, and counts missed', async () => {
		const prisma = setup({
			blocks: [
				{ actualEnd: at('2026-11-02T10:50:00Z'), actualStart: at('2026-11-02T10:00:00Z'), plannedEnd: at('2026-11-02T11:00:00Z'), plannedStart: at('2026-11-02T10:00:00Z'), status: 'done' },
				{
					actualEnd: at('2026-11-02T12:20:00Z'),
					actualStart: at('2026-11-02T12:00:00Z'),
					plannedEnd: at('2026-11-02T13:00:00Z'),
					plannedStart: at('2026-11-02T12:00:00Z'),
					status: 'interrupted',
				},
				{ actualEnd: null, actualStart: null, plannedEnd: at('2026-11-02T15:00:00Z'), plannedStart: at('2026-11-02T14:00:00Z'), status: 'missed' },
			],
		});
		const result = await computePrefill(prisma, TEST_USER_ID, '2026-11-02', '2026-11-02');
		expect(result.counters).toMatchObject({ actualMinutes: 70, plannedMinutes: 180 });
		expect(result.missedBlocks).toBe(1);
	});

	it('reports blocker reasons that repeat (ignoring case and spaces) and are active in the period, most frequent first', async () => {
		const prisma = setup({
			blockers: [
				{ reason: 'Waiting for design', resolvedAt: at('2026-10-05T00:00:00Z'), startedAt: at('2026-10-01T00:00:00Z') },
				{ reason: ' waiting for DESIGN ', resolvedAt: null, startedAt: at('2026-11-02T09:00:00Z') },
				{ reason: 'Waiting for design', resolvedAt: null, startedAt: at('2026-11-02T10:00:00Z') },
				{ reason: 'No access', resolvedAt: null, startedAt: at('2026-11-02T11:00:00Z') },
				{ reason: 'Old problem', resolvedAt: null, startedAt: at('2026-10-01T00:00:00Z') },
				{ reason: 'old problem', resolvedAt: null, startedAt: at('2026-10-02T00:00:00Z') },
			],
		});
		const result = await computePrefill(prisma, TEST_USER_ID, '2026-11-02', '2026-11-02');
		expect(result.recurringBlockers).toEqual([{ occurrences: 3, reason: 'Waiting for design', startedAt: at('2026-11-02T10:00:00Z'), stillOpen: 2 }]);
	});

	it('maps priority and due date changes with from/to', async () => {
		const prisma = setup({
			events: [
				{ fromDueDate: at('2026-11-05'), id: 'e1', occurredAt: at('2026-11-02T10:00:00Z'), task: { id: 't1', title: 'A' }, toDueDate: null, type: 'due_changed' },
				{ fromPriority: 'low', id: 'e2', occurredAt: at('2026-11-02T09:00:00Z'), task: { id: 't2', title: 'B' }, toPriority: 'urgent', type: 'priority_changed' },
			],
		});
		const { changes } = await computePrefill(prisma, TEST_USER_ID, '2026-11-02', '2026-11-02');
		expect(changes).toEqual([
			{ from: '2026-11-05', id: 'e1', occurredAt: at('2026-11-02T10:00:00Z'), task: { id: 't1', title: 'A' }, to: null, type: 'due_changed' },
			{ from: 'low', id: 'e2', occurredAt: at('2026-11-02T09:00:00Z'), task: { id: 't2', title: 'B' }, to: 'urgent', type: 'priority_changed' },
		]);
	});
});
