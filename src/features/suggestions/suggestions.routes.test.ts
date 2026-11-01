import { describe, expect, it, vi } from 'vitest';
import { createMockPrisma, createTestApp, TEST_USER_ID } from '../../test/helpers.js';
import routes from './suggestions.routes.js';

const setup = (claims?: { sub: string } | null) => {
	const prisma = createMockPrisma();
	vi.mocked(prisma.task.findMany).mockResolvedValue([]);
	vi.mocked(prisma.dailyPlanItem.findMany).mockResolvedValue([]);
	vi.mocked(prisma.availabilityWindow.findMany).mockResolvedValue([]);
	vi.mocked(prisma.calendarEvent.findMany).mockResolvedValue([]);
	vi.mocked(prisma.timeBlock.findMany).mockResolvedValue([]);
	return { app: createTestApp(routes, { claims, path: '/suggestions', prisma }), prisma };
};

describe('GET /suggestions/next', () => {
	it('answers 401 when unauthenticated', async () => {
		const res = await setup(null).app.request('/suggestions/next');
		expect(res.status).toBe(401);
		expect(await res.json()).toMatchObject({ error: { code: 'unauthorized' } });
	});

	it('returns the suggestions envelope for the claims user', async () => {
		const { app, prisma } = setup();
		const task = {
			blockers: [],
			createdAt: new Date(),
			dependencies: [],
			dueDate: null,
			estimatedMinutes: null,
			goal: null,
			goalId: null,
			id: 'a',
			priority: 'urgent',
			project: null,
			projectId: null,
			startDate: null,
			status: 'todo',
			subtasks: [],
			title: 'A',
		};
		vi.mocked(prisma.task.findMany).mockResolvedValue([task] as never);
		const res = await app.request('/suggestions/next?date=2026-11-02&limit=5');
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: { date: string; excluded: object; suggestions: { rank: number; reasons: unknown[]; task: { id: string } }[] } };
		expect(body.data.date).toBe('2026-11-02');
		expect(body.data.excluded).toEqual({ blocked: 0, notStarted: 0 });
		expect(body.data.suggestions).toMatchObject([{ rank: 1, reasons: [{ code: 'priority_urgent' }], task: { id: 'a' } }]);
		expect(prisma.task.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerId: TEST_USER_ID, status: { in: ['todo', 'in_progress'] } } }));
	});

	it.each(['date=nope', 'date=2026-13-01', 'limit=0', 'limit=51', 'limit=abc'])('answers 422 for ?%s', async query => {
		const res = await setup().app.request(`/suggestions/next?${query}`);
		expect(res.status).toBe(422);
		expect(await res.json()).toMatchObject({ error: { code: 'validation_error' } });
	});
});
