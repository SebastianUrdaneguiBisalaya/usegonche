import { describe, expect, it, vi } from 'vitest';
import { createMockPrisma, OTHER_USER_ID, TEST_USER_ID } from '../../test/helpers.js';
import { addDependency, removeDependency } from './tasks.dependencies.service.js';

const A = '5d1f0c2e-7a34-4b9e-8c61-2f3a4b5c6d7e';
const B = '9b7e4a10-3c52-4d8f-a1e6-0f2d3c4b5a69';
const C = 'c4d5e6f7-1a2b-4c3d-8e9f-a0b1c2d3e4f5';
const view = { blockers: [], dependencies: [], id: A, ownerId: TEST_USER_ID, status: 'todo', subtasks: [], tags: [] };

// biome-ignore lint/suspicious/noExplicitAny: the mock rows are partial on purpose
const asRow = (value: unknown): any => value;
const rejection = (promise: Promise<unknown>) =>
	promise.then(
		() => null,
		(e: unknown) => e
	);

describe('addDependency', () => {
	it('creates the edge when both tasks are the owner’s and there is no cycle', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.task.findFirst).mockResolvedValue(asRow(view));
		vi.mocked(prisma.taskDependency.findMany).mockResolvedValue([]);

		await addDependency(prisma, TEST_USER_ID, A, B);
		expect(prisma.task.findFirst).toHaveBeenCalledWith({ select: { id: true }, where: { id: B, ownerId: TEST_USER_ID } });
		expect(prisma.taskDependency.createMany).toHaveBeenCalledWith({ data: [{ dependsOnId: B, taskId: A }], skipDuplicates: true });
	});

	it('rejects a self dependency with 422', async () => {
		const prisma = createMockPrisma();
		expect(await rejection(addDependency(prisma, TEST_USER_ID, A, A))).toMatchObject({ details: [{ code: 'self_dependency', field: 'dependsOnId' }], status: 422 });
		expect(prisma.taskDependency.createMany).not.toHaveBeenCalled();
	});

	it('rejects a direct cycle (B already depends on A) with 409', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.task.findFirst).mockResolvedValue(asRow(view));
		vi.mocked(prisma.taskDependency.findMany).mockResolvedValue(asRow([{ dependsOnId: A }]));
		expect(await rejection(addDependency(prisma, TEST_USER_ID, A, B))).toMatchObject({ code: 'dependency_cycle', status: 409 });
		expect(prisma.taskDependency.createMany).not.toHaveBeenCalled();
	});

	it('rejects an indirect cycle (B -> C -> A) with 409', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.task.findFirst).mockResolvedValue(asRow(view));
		vi.mocked(prisma.taskDependency.findMany)
			.mockResolvedValueOnce(asRow([{ dependsOnId: C }]))
			.mockResolvedValueOnce(asRow([{ dependsOnId: A }]));
		expect(await rejection(addDependency(prisma, TEST_USER_ID, A, B))).toMatchObject({ code: 'dependency_cycle', status: 409 });
	});

	it('terminates when the graph reaches shared nodes without a cycle', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.task.findFirst).mockResolvedValue(asRow(view));
		vi.mocked(prisma.taskDependency.findMany)
			.mockResolvedValueOnce(asRow([{ dependsOnId: C }, { dependsOnId: C }]))
			.mockResolvedValueOnce(asRow([{ dependsOnId: C }]))
			.mockResolvedValue([]);
		await addDependency(prisma, TEST_USER_ID, A, B);
		expect(prisma.taskDependency.createMany).toHaveBeenCalled();
	});

	it('throws 404 when the task is not the owner’s', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.task.findFirst).mockResolvedValue(null);
		expect(await rejection(addDependency(prisma, OTHER_USER_ID, A, B))).toMatchObject({ code: 'not_found', status: 404 });
	});

	it('rejects a dependency target that is not the owner’s with 422', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.task.findFirst)
			.mockResolvedValueOnce(asRow({ id: A }))
			.mockResolvedValueOnce(null);
		expect(await rejection(addDependency(prisma, TEST_USER_ID, A, B))).toMatchObject({ details: [{ code: 'not_found', field: 'dependsOnId' }], status: 422 });
	});
});

describe('removeDependency', () => {
	it('removes the edge', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.task.findFirst).mockResolvedValue(asRow(view));
		vi.mocked(prisma.taskDependency.deleteMany).mockResolvedValue({ count: 1 });
		await removeDependency(prisma, TEST_USER_ID, A, B);
		expect(prisma.taskDependency.deleteMany).toHaveBeenCalledWith({ where: { dependsOnId: B, taskId: A } });
	});

	it('throws 404 when the task is not the owner’s or the edge does not exist', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.task.findFirst).mockResolvedValue(null);
		expect(await rejection(removeDependency(prisma, OTHER_USER_ID, A, B))).toMatchObject({ status: 404 });
		expect(prisma.taskDependency.deleteMany).not.toHaveBeenCalled();

		vi.mocked(prisma.task.findFirst).mockResolvedValue(asRow(view));
		vi.mocked(prisma.taskDependency.deleteMany).mockResolvedValue({ count: 0 });
		expect(await rejection(removeDependency(prisma, TEST_USER_ID, A, B))).toMatchObject({ status: 404 });
	});
});
