import { describe, expect, it } from 'vitest';
import { type Candidate, type Context, DUE_SOON_DAYS, explain, OVERDUE_DAYS_CAP, rank } from './suggestions.ranking.js';

const today = new Date('2026-11-02');
const context: Context = { largestFreeSlotMinutes: 60, today };
const day = (offset: number) => new Date(today.getTime() + offset * 86_400_000);

const candidate = (extra: Partial<Candidate> = {}): Candidate => ({
	createdAt: new Date('2026-10-01T00:00:00Z'),
	dueDate: null,
	estimatedMinutes: null,
	goalId: null,
	id: 'a',
	inPlanToday: false,
	priority: 'low',
	projectId: null,
	released: false,
	startDate: null,
	status: 'todo',
	title: 'Task',
	...extra,
});

const codes = (c: Candidate, ctx = context) => explain(c, ctx).reasons.map(r => r.code);

describe('explain (reason codes)', () => {
	it('has no reasons for a plain low-priority task', () => {
		expect(explain(candidate(), context)).toEqual({ points: 0, reasons: [] });
	});

	it('marks overdue tasks with the days overdue', () => {
		expect(explain(candidate({ dueDate: day(-3) }), context).reasons).toEqual([{ code: 'overdue', value: 3 }]);
	});

	it('marks tasks due today and due soon (within the window, not beyond)', () => {
		expect(explain(candidate({ dueDate: day(0) }), context).reasons).toEqual([{ code: 'due_today', value: 0 }]);
		expect(explain(candidate({ dueDate: day(DUE_SOON_DAYS) }), context).reasons).toEqual([{ code: 'due_soon', value: DUE_SOON_DAYS }]);
		expect(codes(candidate({ dueDate: day(DUE_SOON_DAYS + 1) }))).toEqual([]);
	});

	it('explains priority only for high and urgent', () => {
		expect(codes(candidate({ priority: 'urgent' }))).toEqual(['priority_urgent']);
		expect(codes(candidate({ priority: 'high' }))).toEqual(['priority_high']);
		expect(codes(candidate({ priority: 'medium' }))).toEqual([]);
	});

	it('adds planned today, in progress, unblocked and linked to goal', () => {
		expect(codes(candidate({ goalId: 'g', inPlanToday: true, released: true, status: 'in_progress' }))).toEqual(['planned_today', 'in_progress', 'unblocked', 'linked_to_goal']);
	});

	it('fits an available slot only when it has an estimate that fits', () => {
		expect(explain(candidate({ estimatedMinutes: 45 }), context).reasons).toEqual([{ code: 'fits_available_slot', value: 45 }]);
		expect(explain(candidate({ estimatedMinutes: 60 }), context).reasons).toEqual([{ code: 'fits_available_slot', value: 60 }]);
		expect(codes(candidate({ estimatedMinutes: 61 }))).toEqual([]);
		expect(codes(candidate({ estimatedMinutes: null }))).toEqual([]);
		expect(codes(candidate({ estimatedMinutes: 10 }), { ...context, largestFreeSlotMinutes: 0 })).toEqual([]);
	});

	it('caps the extra points for days overdue', () => {
		const far = explain(candidate({ dueDate: day(-OVERDUE_DAYS_CAP - 20) }), context).points;
		const atCap = explain(candidate({ dueDate: day(-OVERDUE_DAYS_CAP) }), context).points;
		expect(far).toBe(atCap);
	});
});

describe('rank', () => {
	it('puts overdue before due today before due soon before the rest', () => {
		const result = rank(
			[candidate({ id: 'rest', priority: 'urgent' }), candidate({ dueDate: day(2), id: 'soon' }), candidate({ dueDate: day(0), id: 'today' }), candidate({ dueDate: day(-1), id: 'overdue' })],
			context,
			10
		);
		expect(result.map(s => s.task.id)).toEqual(['overdue', 'today', 'soon', 'rest']);
		expect(result.map(s => s.rank)).toEqual([1, 2, 3, 4]);
	});

	it('ranks a longer overdue task above a shorter one', () => {
		expect(rank([candidate({ dueDate: day(-1), id: 'a' }), candidate({ dueDate: day(-5), id: 'b' })], context, 10).map(s => s.task.id)).toEqual(['b', 'a']);
	});

	it('lets priority and plan outweigh a far or missing deadline', () => {
		const result = rank([candidate({ id: 'low' }), candidate({ id: 'planned', inPlanToday: true }), candidate({ id: 'urgent', priority: 'urgent' })], context, 10);
		expect(result.map(s => s.task.id)).toEqual(['urgent', 'planned', 'low']);
	});

	it('breaks ties deterministically: due date, priority, creation time, then id', () => {
		const same = { priority: 'medium' as const };
		expect(rank([candidate({ ...same, dueDate: day(10), id: 'late' }), candidate({ ...same, dueDate: day(8), id: 'early' })], context, 10).map(s => s.task.id)).toEqual(['early', 'late']);
		expect(
			rank([candidate({ createdAt: new Date('2026-10-05T00:00:00Z'), id: 'new' }), candidate({ createdAt: new Date('2026-10-01T00:00:00Z'), id: 'old' })], context, 10).map(s => s.task.id)
		).toEqual(['old', 'new']);
		expect(rank([candidate({ id: 'b' }), candidate({ id: 'a' })], context, 10).map(s => s.task.id)).toEqual(['a', 'b']);
	});

	it('is deterministic whatever the input order', () => {
		const items = ['a', 'b', 'c', 'd'].map((id, index) => candidate({ dueDate: index % 2 ? day(1) : null, id }));
		const forward = rank(items, context, 10).map(s => s.task.id);
		expect(rank([...items].reverse(), context, 10).map(s => s.task.id)).toEqual(forward);
	});

	it('keeps only `limit` and exposes reasons, not scores or internal flags', () => {
		const result = rank([candidate({ dueDate: day(0), id: 'a' }), candidate({ id: 'b' }), candidate({ id: 'c' })], context, 1);
		expect(result).toHaveLength(1);
		expect(result[0]).toEqual({ rank: 1, reasons: [{ code: 'due_today', value: 0 }], task: expect.not.objectContaining({ inPlanToday: expect.anything(), released: expect.anything() }) });
		expect(JSON.stringify(result)).not.toMatch(/score|points/);
	});

	it('returns nothing without candidates', () => {
		expect(rank([], context, 10)).toEqual([]);
	});
});
