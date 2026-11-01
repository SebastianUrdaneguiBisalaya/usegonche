import type { PrismaClient } from '@usegonche/database';
import { AppError } from '../../lib/errors.js';
import { scoped } from '../../lib/owner.js';
import { getTask, type TaskView } from './tasks.service.js';

/** True when `target` is reachable from `from` by following "depends on" edges (so adding target -> from would close a cycle). */
const reaches = async (prisma: PrismaClient, from: string, target: string): Promise<boolean> => {
	const visited = new Set([from]);
	let frontier = [from];
	while (frontier.length > 0) {
		const edges = await prisma.taskDependency.findMany({ select: { dependsOnId: true }, where: { taskId: { in: frontier } } });
		const next = edges.map(edge => edge.dependsOnId).filter(id => !visited.has(id));
		if (next.includes(target)) return true;
		for (const id of next) visited.add(id);
		frontier = [...new Set(next)];
	}
	return false;
};

/**
 * `id` starts waiting for `dependsOnId`. Both must be the owner's; no self-dependency (422) and no cycles (409).
 * Adding an existing dependency is a no-op.
 */
export const addDependency = (prisma: PrismaClient, ownerId: string, id: string, dependsOnId: string): Promise<TaskView> =>
	prisma.$transaction(async tx => {
		if (id === dependsOnId) throw new AppError('validation_error', 422, [{ code: 'self_dependency', field: 'dependsOnId' }]);
		if (!(await tx.task.findFirst({ select: { id: true }, where: scoped(ownerId, { id }) }))) throw new AppError('not_found', 404);
		if (!(await tx.task.findFirst({ select: { id: true }, where: scoped(ownerId, { id: dependsOnId }) })))
			throw new AppError('validation_error', 422, [{ code: 'not_found', field: 'dependsOnId' }]);
		if (await reaches(tx as PrismaClient, dependsOnId, id)) throw new AppError('dependency_cycle', 409);
		await tx.taskDependency.createMany({ data: [{ dependsOnId, taskId: id }], skipDuplicates: true });
		return getTask(tx, ownerId, id);
	});

export const removeDependency = (prisma: PrismaClient, ownerId: string, id: string, dependsOnId: string): Promise<TaskView> =>
	prisma.$transaction(async tx => {
		if (!(await tx.task.findFirst({ select: { id: true }, where: scoped(ownerId, { id }) }))) throw new AppError('not_found', 404);
		const { count } = await tx.taskDependency.deleteMany({ where: { dependsOnId, taskId: id } });
		if (count === 0) throw new AppError('not_found', 404);
		return getTask(tx, ownerId, id);
	});
