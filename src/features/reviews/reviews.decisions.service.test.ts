import { describe, expect, it, vi } from 'vitest';
import { createMockPrisma, OTHER_USER_ID, TEST_USER_ID } from '../../test/helpers.js';
import { applyDecisions } from './reviews.decisions.service.js';

const REVIEW = '5d1f0c2e-7a34-4b9e-8c61-2f3a4b5c6d7e';
const T1 = '9b7e4a10-3c52-4d8f-a1e6-0f2d3c4b5a69';
const T2 = 'c4d5e6f7-1a2b-4c3d-8e9f-a0b1c2d3e4f5';

// biome-ignore lint/suspicious/noExplicitAny: the mock rows are partial on purpose
const asRow = (value: unknown): any => value;
const rejection = (promise: Promise<unknown>) =>
	promise.then(
		() => null,
		(e: unknown) => e
	);

const openTask = (extra: object = {}) => ({ dueDate: new Date('2026-11-03'), priority: 'medium', projectId: null, startDate: null, status: 'todo', ...extra });
const setup = (task: object | null = openTask(), review: object | null = { status: 'open' }) => {
	const prisma = createMockPrisma();
	vi.mocked(prisma.review.findFirst).mockResolvedValue(asRow(review));
	vi.mocked(prisma.reviewDecision.count).mockResolvedValue(0);
	vi.mocked(prisma.task.findFirst).mockResolvedValue(asRow(task));
	vi.mocked(prisma.reviewDecision.findMany).mockResolvedValue([]);
	return prisma;
};

describe('applyDecisions', () => {
	it('records the decisions with their target dates', async () => {
		const prisma = setup();
		vi.mocked(prisma.dailyPlan.upsert).mockResolvedValue(asRow({ id: 'plan' }));
		await applyDecisions(prisma, TEST_USER_ID, REVIEW, [
			{ action: 'keep', taskId: T1 },
			{ action: 'carry_over', date: '2026-11-03', taskId: T2 },
		]);
		expect(prisma.reviewDecision.createMany).toHaveBeenCalledWith({
			data: [
				{ action: 'keep', ownerId: TEST_USER_ID, reviewId: REVIEW, targetDate: null, taskId: T1 },
				{ action: 'carry_over', ownerId: TEST_USER_ID, reviewId: REVIEW, targetDate: new Date('2026-11-03'), taskId: T2 },
			],
		});
	});

	it('keep changes nothing on the task', async () => {
		const prisma = setup();
		await applyDecisions(prisma, TEST_USER_ID, REVIEW, [{ action: 'keep', taskId: T1 }]);
		expect(prisma.task.updateMany).not.toHaveBeenCalled();
		expect(prisma.taskEvent.createMany).not.toHaveBeenCalled();
		expect(prisma.dailyPlanItem.create).not.toHaveBeenCalled();
	});

	it('carry_over appends the task at the end of the plan of that date', async () => {
		const prisma = setup();
		vi.mocked(prisma.dailyPlan.upsert).mockResolvedValue(asRow({ id: 'plan' }));
		vi.mocked(prisma.dailyPlanItem.findFirst).mockResolvedValue(null);
		vi.mocked(prisma.dailyPlanItem.count).mockResolvedValue(2);
		await applyDecisions(prisma, TEST_USER_ID, REVIEW, [{ action: 'carry_over', date: '2026-11-03', taskId: T1 }]);
		expect(prisma.dailyPlan.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerId_date: { date: new Date('2026-11-03'), ownerId: TEST_USER_ID } } }));
		expect(prisma.dailyPlanItem.create).toHaveBeenCalledWith({ data: { ownerId: TEST_USER_ID, planId: 'plan', position: 2, taskId: T1 } });
	});

	it('carry_over is a no-op for a task already in that plan', async () => {
		const prisma = setup();
		vi.mocked(prisma.dailyPlan.upsert).mockResolvedValue(asRow({ id: 'plan' }));
		vi.mocked(prisma.dailyPlanItem.findFirst).mockResolvedValue(asRow({ id: 'item' }));
		await applyDecisions(prisma, TEST_USER_ID, REVIEW, [{ action: 'carry_over', date: '2026-11-03', taskId: T1 }]);
		expect(prisma.dailyPlanItem.create).not.toHaveBeenCalled();
	});

	it('reschedule moves the due date and writes a due_changed history event', async () => {
		const prisma = setup();
		await applyDecisions(prisma, TEST_USER_ID, REVIEW, [{ action: 'reschedule', date: '2026-11-10', taskId: T1 }]);
		expect(prisma.task.updateMany).toHaveBeenCalledWith({ data: { dueDate: new Date('2026-11-10') }, where: { id: T1, ownerId: TEST_USER_ID } });
		expect(prisma.taskEvent.createMany).toHaveBeenCalledWith({
			data: [{ fromDueDate: new Date('2026-11-03'), ownerId: TEST_USER_ID, taskId: T1, toDueDate: new Date('2026-11-10'), type: 'due_changed' }],
		});
	});

	it('reschedule rejects a due date before the start date', async () => {
		const prisma = setup(openTask({ startDate: new Date('2026-11-20') }));
		expect(await rejection(applyDecisions(prisma, TEST_USER_ID, REVIEW, [{ action: 'reschedule', date: '2026-11-10', taskId: T1 }]))).toMatchObject({
			details: [{ code: 'due_before_start', field: 'decisions' }],
			status: 422,
		});
		expect(prisma.task.updateMany).not.toHaveBeenCalled();
	});

	it('drop cancels the task and writes a status_changed history event', async () => {
		const prisma = setup();
		await applyDecisions(prisma, TEST_USER_ID, REVIEW, [{ action: 'drop', taskId: T1 }]);
		expect(prisma.task.updateMany).toHaveBeenCalledWith({ data: { completedAt: null, status: 'cancelled' }, where: { id: T1, ownerId: TEST_USER_ID } });
		expect(prisma.taskEvent.createMany).toHaveBeenCalledWith({ data: [{ fromStatus: 'todo', ownerId: TEST_USER_ID, taskId: T1, toStatus: 'cancelled', type: 'status_changed' }] });
	});

	it('rejects tasks that are not the owner’s or are already finished, applying nothing', async () => {
		const missing = setup(null);
		expect(await rejection(applyDecisions(missing, TEST_USER_ID, REVIEW, [{ action: 'drop', taskId: T1 }]))).toMatchObject({ details: [{ code: 'not_found', field: 'decisions' }], status: 422 });
		expect(missing.reviewDecision.createMany).not.toHaveBeenCalled();

		const done = setup(openTask({ status: 'done' }));
		expect(await rejection(applyDecisions(done, TEST_USER_ID, REVIEW, [{ action: 'drop', taskId: T1 }]))).toMatchObject({ details: [{ code: 'task_closed', field: 'decisions' }] });
		expect(done.task.updateMany).not.toHaveBeenCalled();
	});

	it('throws 404 for another owner’s review and 409 for a closed one', async () => {
		expect(await rejection(applyDecisions(setup(openTask(), null), OTHER_USER_ID, REVIEW, [{ action: 'keep', taskId: T1 }]))).toMatchObject({ code: 'not_found', status: 404 });
		expect(await rejection(applyDecisions(setup(openTask(), { status: 'closed' }), TEST_USER_ID, REVIEW, [{ action: 'keep', taskId: T1 }]))).toMatchObject({ code: 'invalid_state', status: 409 });
	});

	it('answers 409 when a task already has a decision in this review', async () => {
		const prisma = setup();
		vi.mocked(prisma.reviewDecision.count).mockResolvedValue(1);
		expect(await rejection(applyDecisions(prisma, TEST_USER_ID, REVIEW, [{ action: 'drop', taskId: T1 }]))).toMatchObject({ code: 'already_exists', status: 409 });
		expect(prisma.task.updateMany).not.toHaveBeenCalled();
		expect(prisma.reviewDecision.count).toHaveBeenCalledWith({ where: { ownerId: TEST_USER_ID, reviewId: REVIEW, taskId: { in: [T1] } } });
	});
});
