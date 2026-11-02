import { describe, expect, it, vi } from 'vitest';
import tags from '../features/tags/tags.routes.js';
import { createMockPrisma, createTestApp } from '../test/helpers.js';

describe('requireAuth email confirmation', () => {
	it('answers 403 email_not_confirmed when the email is not confirmed', async () => {
		const app = createTestApp(tags, { emailConfirmed: false, path: '/tags', prisma: createMockPrisma() });
		const res = await app.request('/tags');
		expect(res.status).toBe(403);
		expect(await res.json()).toMatchObject({ error: { code: 'email_not_confirmed' } });
	});

	it('lets confirmed users through', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.tag.findMany).mockResolvedValue([]);
		const app = createTestApp(tags, { path: '/tags', prisma });
		const res = await app.request('/tags');
		expect(res.status).toBe(200);
	});
});
