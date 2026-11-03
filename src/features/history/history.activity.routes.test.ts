import type { TaskEvent } from '@usegonche/database';
import { describe, expect, it, vi } from 'vitest';
import { createMockPrisma, createTestApp, TEST_USER_ID } from '../../test/helpers.js';
import routes from './history.activity.routes.js';

const TASK = '5d1f0c2e-7a34-4b9e-8c61-2f3a4b5c6d7e';
const row = {
	fromStatus: 'todo',
	id: 'a',
	occurredAt: new Date('2026-11-01T10:00:00.000Z'),
	ownerId: TEST_USER_ID,
	task: { title: 'Write docs' },
	taskId: TASK,
	toStatus: 'done',
	type: 'status_changed',
} as unknown as TaskEvent;

const setup = (claims?: { sub: string } | null) => {
	const prisma = createMockPrisma();
	return { app: createTestApp(routes, { claims, path: '/history', prisma }), prisma };
};

describe('GET /history', () => {
	it('answers 401 when unauthenticated', async () => {
		const res = await setup(null).app.request('/history');
		expect(res.status).toBe(401);
		expect(await res.json()).toMatchObject({ error: { code: 'unauthorized' } });
	});

	it('lists the activity of the user with the task title and meta, the user coming from the claims', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.taskEvent.findMany).mockResolvedValue([row] as never);
		vi.mocked(prisma.taskEvent.count).mockResolvedValue(1);
		const res = await app.request('/history');
		expect(res.status).toBe(200);
		const { task: _task, ...event } = JSON.parse(JSON.stringify(row));
		expect(await res.json()).toEqual({ data: [{ ...event, taskTitle: 'Write docs' }], meta: { page: 1, pageCount: 1, pageSize: 50, total: 1 } });
		expect(prisma.taskEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 50, where: { ownerId: TEST_USER_ID } }));
	});

	it('reports the page count and skips the previous pages', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.taskEvent.findMany).mockResolvedValue([row] as never);
		vi.mocked(prisma.taskEvent.count).mockResolvedValue(5);
		const body = (await (await app.request('/history?page=2&pageSize=2')).json()) as { meta: unknown };
		expect(body.meta).toEqual({ page: 2, pageCount: 3, pageSize: 2, total: 5 });
		expect(prisma.taskEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 2, take: 2 }));
	});

	it.each(['pageSize=0', 'pageSize=101', 'page=0', 'page=x'])('answers 422 for ?%s', async query => {
		expect((await setup().app.request(`/history?${query}`)).status).toBe(422);
	});
});
