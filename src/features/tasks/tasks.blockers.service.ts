import type { PrismaClient, TaskBlocker } from '@usegonche/database';
import { AppError } from '../../lib/errors.js';
import { scoped } from '../../lib/owner.js';

const assertTask = async (prisma: PrismaClient, ownerId: string, taskId: string): Promise<void> => {
	if (!(await prisma.task.findFirst({ select: { id: true }, where: scoped(ownerId, { id: taskId }) }))) throw new AppError('not_found', 404);
};

/** Every blocker of the task, resolved ones included (they are the history used to spot recurring blockers). Newest first. */
export const listBlockers = async (prisma: PrismaClient, ownerId: string, taskId: string): Promise<TaskBlocker[]> => {
	await assertTask(prisma, ownerId, taskId);
	return prisma.taskBlocker.findMany({ orderBy: [{ startedAt: 'desc' }, { id: 'desc' }], where: scoped(ownerId, { taskId }) });
};

export const createBlocker = async (prisma: PrismaClient, ownerId: string, taskId: string, reason: string): Promise<TaskBlocker> => {
	await assertTask(prisma, ownerId, taskId);
	return prisma.taskBlocker.create({ data: { ownerId, reason, taskId } });
};

/** Sets `resolvedAt`. 404 if the blocker is not the owner's task's, 409 if it was already resolved. */
export const resolveBlocker = async (prisma: PrismaClient, ownerId: string, taskId: string, blockerId: string): Promise<TaskBlocker> => {
	const { count } = await prisma.taskBlocker.updateMany({ data: { resolvedAt: new Date() }, where: scoped(ownerId, { id: blockerId, resolvedAt: null, taskId }) });
	const blocker = await prisma.taskBlocker.findFirst({ where: scoped(ownerId, { id: blockerId, taskId }) });
	if (!blocker) throw new AppError('not_found', 404);
	if (count === 0) throw new AppError('invalid_state', 409);
	return blocker;
};
