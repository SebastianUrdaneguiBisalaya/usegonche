import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMockPrisma, createTestApp } from '../../test/helpers.js';
import routes, { SECRET_HEADER } from './reminders.internal.routes.js';

const SECRET = 'a-long-random-shared-secret';
const due = { id: '5d1f0c2e-7a34-4b9e-8c61-2f3a4b5c6d7e', status: 'pending' };

// biome-ignore lint/suspicious/noExplicitAny: the mock rows are partial on purpose
const asRow = (value: unknown): any => value;

const call = (headers: Record<string, string> = {}, secret: string | undefined = SECRET) => {
	vi.stubEnv('INTERNAL_CRON_SECRET', secret ?? '');
	const prisma = createMockPrisma();
	vi.mocked(prisma.reminder.findMany).mockResolvedValue(asRow([due]));
	vi.mocked(prisma.reminder.updateMany).mockResolvedValue({ count: 1 });
	// No claims on purpose: the endpoint must not depend on a user session.
	const app = createTestApp(routes, { claims: null, path: '/internal/reminders', prisma });
	return { prisma, res: app.request('/internal/reminders/process', { headers, method: 'POST' }) };
};

afterEach(() => vi.unstubAllEnvs());

describe('POST /internal/reminders/process', () => {
	it('processes the due reminders with the right secret, without a user session', async () => {
		const { prisma, res } = call({ [SECRET_HEADER]: SECRET });
		const response = await res;
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ data: { claimed: 1, failed: 0 } });
		expect(prisma.reminder.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'sent' }) }));
	});

	it.each([
		['a wrong secret', { [SECRET_HEADER]: 'nope' }, SECRET],
		['a missing header', {}, SECRET],
		['a bearer token instead of the secret', { authorization: `Bearer ${SECRET}` }, SECRET],
		['no configured secret', { [SECRET_HEADER]: '' }, undefined],
	])('answers 401 and touches nothing for %s', async (_name, headers, secret) => {
		const { prisma, res } = call(headers, secret);
		const response = await res;
		expect(response.status).toBe(401);
		expect(await response.json()).toMatchObject({ error: { code: 'unauthorized' } });
		expect(prisma.reminder.findMany).not.toHaveBeenCalled();
	});
});
