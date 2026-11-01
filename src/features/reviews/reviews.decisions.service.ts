import type { Prisma, PrismaClient, ReviewDecision } from '@usegonche/database';
import { AppError } from '../../lib/errors.js';
import { scoped } from '../../lib/owner.js';
import { diffTaskChanges, recordTaskEvents } from '../history/history.service.js';
import { CLOSED_TASK } from '../planning/planning.shared.js';
import type { DecisionInput } from './reviews.schemas.js';

type Db = PrismaClient | Prisma.TransactionClient;

const invalid = (field: string, code: string): AppError => new AppError('validation_error', 422, [{ code, field }]);

/** Adds the task at the end of the plan of `date` (creating the plan when needed). Already planned: nothing to do. */
const planForDate = async (prisma: Db, ownerId: string, taskId: string, date: string): Promise<void> => {
	const plan = await prisma.dailyPlan.upsert({ create: { date: new Date(date), ownerId }, select: { id: true }, update: {}, where: { ownerId_date: { date: new Date(date), ownerId } } });
	if (await prisma.dailyPlanItem.findFirst({ select: { id: true }, where: scoped(ownerId, { planId: plan.id, taskId }) })) return;
	const position = await prisma.dailyPlanItem.count({ where: scoped(ownerId, { planId: plan.id }) });
	await prisma.dailyPlanItem.create({ data: { ownerId, planId: plan.id, position, taskId } });
};

/**
 * Applies one decision to its task:
 * - `carry_over`: plans the task for `date`.
 * - `reschedule`: moves the due date to `date` (writes a `due_changed` history event).
 * - `drop`: cancels the task (writes a `status_changed` history event).
 * - `keep`: nothing changes.
 * Only open tasks of the owner can be decided on.
 */
const apply = async (prisma: Db, ownerId: string, decision: DecisionInput): Promise<void> => {
	const task = await prisma.task.findFirst({ select: { dueDate: true, priority: true, projectId: true, startDate: true, status: true }, where: scoped(ownerId, { id: decision.taskId }) });
	if (!task) throw invalid('decisions', 'not_found');
	if ((CLOSED_TASK as readonly string[]).includes(task.status)) throw invalid('decisions', 'task_closed');

	if (decision.action === 'carry_over' && decision.date) await planForDate(prisma, ownerId, decision.taskId, decision.date);

	if (decision.action === 'reschedule' && decision.date) {
		const dueDate = new Date(decision.date);
		if (task.startDate && dueDate < task.startDate) throw invalid('decisions', 'due_before_start');
		await prisma.task.updateMany({ data: { dueDate }, where: scoped(ownerId, { id: decision.taskId }) });
		await recordTaskEvents(prisma, ownerId, decision.taskId, diffTaskChanges(task, { dueDate }));
	}

	if (decision.action === 'drop') {
		await prisma.task.updateMany({ data: { completedAt: null, status: 'cancelled' }, where: scoped(ownerId, { id: decision.taskId }) });
		await recordTaskEvents(prisma, ownerId, decision.taskId, diffTaskChanges(task, { status: 'cancelled' }));
	}
};

/**
 * Applies and records the decisions of an open review in one transaction: if any fails, none is applied.
 * A task can be decided once per review (409 afterwards), because the effects cannot be undone.
 */
export const applyDecisions = (prisma: PrismaClient, ownerId: string, reviewId: string, decisions: DecisionInput[]): Promise<ReviewDecision[]> =>
	prisma.$transaction(async tx => {
		const review = await tx.review.findFirst({ select: { status: true }, where: scoped(ownerId, { id: reviewId }) });
		if (!review) throw new AppError('not_found', 404);
		if (review.status !== 'open') throw new AppError('invalid_state', 409);

		const existing = await tx.reviewDecision.count({ where: scoped(ownerId, { reviewId, taskId: { in: decisions.map(decision => decision.taskId) } }) });
		if (existing > 0) throw new AppError('already_exists', 409);

		for (const decision of decisions) await apply(tx, ownerId, decision);
		await tx.reviewDecision.createMany({
			data: decisions.map(decision => ({ action: decision.action, ownerId, reviewId, targetDate: decision.date ? new Date(decision.date) : null, taskId: decision.taskId })),
		});
		return tx.reviewDecision.findMany({ orderBy: [{ decidedAt: 'asc' }, { id: 'asc' }], where: scoped(ownerId, { reviewId }) });
	});
