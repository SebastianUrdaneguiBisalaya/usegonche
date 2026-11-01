import type { Profile, UserSettings } from '@usegonche/database';
import { describe, expect, it, vi } from 'vitest';
import { createMockPrisma, createTestApp, jsonRequest, TEST_USER_ID } from '../../test/helpers.js';
import routes from './profile.routes.js';

const profile = { displayName: 'Ana', email: 'me@example.com', id: TEST_USER_ID } as Profile;
const settings = { id: 's1', language: 'en', ownerId: TEST_USER_ID, theme: 'system', timezone: 'UTC' } as UserSettings;

const setup = (options: { claims?: { email?: string; sub: string } | null } = {}) => {
	const prisma = createMockPrisma();
	vi.mocked(prisma.profile.upsert).mockResolvedValue(profile);
	vi.mocked(prisma.userSettings.upsert).mockResolvedValue(settings);
	return { app: createTestApp(routes, { ...options, path: '/profile', prisma }), prisma };
};

describe.each([
	['GET', '/profile'],
	['PATCH', '/profile'],
	['GET', '/profile/settings'],
	['PATCH', '/profile/settings'],
])('%s %s', (method, path) => {
	it('answers 401 when unauthenticated', async () => {
		const { app } = setup({ claims: null });
		const res = await app.request(path, method === 'GET' ? undefined : jsonRequest('PATCH', { theme: 'dark' }));
		expect(res.status).toBe(401);
		expect(await res.json()).toMatchObject({ error: { code: 'unauthorized' } });
	});
});

describe('GET /profile', () => {
	it('returns the profile of the authenticated user', async () => {
		const { app, prisma } = setup({ claims: { email: 'me@example.com', sub: TEST_USER_ID } });
		const res = await app.request('/profile');
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ data: profile });
		expect(prisma.profile.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { id: TEST_USER_ID } }));
	});
});

describe('PATCH /profile', () => {
	it('updates the profile', async () => {
		const { app, prisma } = setup();
		const res = await app.request('/profile', jsonRequest('PATCH', { displayName: 'Ana', websiteUrl: null }));
		expect(res.status).toBe(200);
		expect(vi.mocked(prisma.profile.upsert).mock.calls[0]?.[0].update).toEqual({ displayName: 'Ana', websiteUrl: null });
	});

	it('takes the user from the claims, never from the body', async () => {
		const { app } = setup();
		const res = await app.request('/profile', jsonRequest('PATCH', { id: 'someone-else', displayName: 'x' }));
		expect(res.status).toBe(422);
	});

	it.each([
		['an empty body', {}],
		['an invalid url', { websiteUrl: 'not-a-url' }],
		['a too long name', { displayName: 'x'.repeat(101) }],
		['unknown keys', { admin: true }],
	])('rejects %s with 422 and details', async (_name, body) => {
		const { app, prisma } = setup();
		const res = await app.request('/profile', jsonRequest('PATCH', body));
		expect(res.status).toBe(422);
		expect(await res.json()).toMatchObject({ error: { code: 'validation_error' } });
		expect(prisma.profile.upsert).not.toHaveBeenCalled();
	});

	it('requires a JSON content type', async () => {
		const { app } = setup();
		const res = await app.request('/profile', { body: '{"displayName":"x"}', method: 'PATCH' });
		expect(res.status).toBe(422);
	});
});

describe('GET /profile/settings', () => {
	it('returns (and creates on first access) the settings', async () => {
		const { app } = setup();
		const res = await app.request('/profile/settings');
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ data: settings });
	});
});

describe('PATCH /profile/settings', () => {
	it('updates the settings', async () => {
		const { app, prisma } = setup();
		const res = await app.request('/profile/settings', jsonRequest('PATCH', { language: 'es', theme: 'dark', timezone: 'America/Lima' }));
		expect(res.status).toBe(200);
		expect(vi.mocked(prisma.userSettings.upsert).mock.calls[0]?.[0].update).toEqual({ language: 'es', theme: 'dark', timezone: 'America/Lima' });
	});

	it.each([
		['an unknown theme', { theme: 'neon' }],
		['an invalid timezone', { timezone: 'Mars/Olympus' }],
		['an invalid language', { language: 'not a language' }],
		['an empty body', {}],
		['an owner override', { ownerId: 'x' }],
	])('rejects %s with 422', async (_name, body) => {
		const { app, prisma } = setup();
		const res = await app.request('/profile/settings', jsonRequest('PATCH', body));
		expect(res.status).toBe(422);
		expect(await res.json()).toMatchObject({ error: { code: 'validation_error' } });
		expect(prisma.userSettings.upsert).not.toHaveBeenCalled();
	});
});
