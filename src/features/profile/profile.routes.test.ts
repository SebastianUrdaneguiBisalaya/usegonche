import type { Profile, UserSettings } from '@usegonche/database';
import { describe, expect, it, vi } from 'vitest';
import { createMockPrisma, createMockStorage, createTestApp, jsonRequest, TEST_USER_ID } from '../../test/helpers.js';
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
		vi.mocked(prisma.profile.update).mockResolvedValue({ ...profile, displayName: 'Beto' });
		const res = await app.request('/profile', jsonRequest('PATCH', { displayName: 'Beto', websiteUrl: null }));
		expect(res.status).toBe(200);
		expect(prisma.profile.update).toHaveBeenCalledWith({ data: { displayName: 'Beto' }, where: { id: TEST_USER_ID } });
	});

	it('answers 200 with the profile and writes nothing when nothing changes', async () => {
		const { app, prisma } = setup();
		const res = await app.request('/profile', jsonRequest('PATCH', { displayName: 'Ana' }));
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ data: profile });
		expect(prisma.profile.update).not.toHaveBeenCalled();
	});

	it('never changes the email: it is not part of the schema', async () => {
		const { app, prisma } = setup();
		const res = await app.request('/profile', jsonRequest('PATCH', { displayName: 'x', email: 'other@example.com' }));
		expect(res.status).toBe(422);
		expect(prisma.profile.update).not.toHaveBeenCalled();
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
		vi.mocked(prisma.userSettings.update).mockResolvedValue({ ...settings, language: 'es' });
		const res = await app.request('/profile/settings', jsonRequest('PATCH', { language: 'es', theme: 'system', timezone: 'America/Lima' }));
		expect(res.status).toBe(200);
		expect(prisma.userSettings.update).toHaveBeenCalledWith({ data: { language: 'es', timezone: 'America/Lima' }, where: { ownerId: TEST_USER_ID } });
	});

	it('answers 200 and writes nothing when the settings do not change', async () => {
		const { app, prisma } = setup();
		const res = await app.request('/profile/settings', jsonRequest('PATCH', { language: 'en', timezone: 'UTC' }));
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ data: settings });
		expect(prisma.userSettings.update).not.toHaveBeenCalled();
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

describe('POST /profile/avatar/upload-url', () => {
	it('answers 401 when unauthenticated', async () => {
		const { app } = setup({ claims: null });
		expect((await app.request('/profile/avatar/upload-url', jsonRequest('POST', { mimeType: 'image/png', sizeBytes: 10 }))).status).toBe(401);
	});

	it.each([
		[{ mimeType: 'application/pdf', sizeBytes: 10 }],
		[{ mimeType: 'image/png', sizeBytes: 0 }],
		[{ mimeType: 'image/png', sizeBytes: 6 * 1024 * 1024 }],
		[{ mimeType: 'image/png', sizeBytes: 10, ownerId: 'someone-else' }],
	])('rejects an invalid body %j', async body => {
		const { app } = setup();
		const res = await app.request('/profile/avatar/upload-url', jsonRequest('POST', body));
		expect(res.status).toBe(422);
		expect(await res.json()).toMatchObject({ error: { code: 'validation_error' } });
	});

	it('answers a signed upload url for the authenticated user', async () => {
		const prisma = createMockPrisma();
		const storage = createMockStorage();
		vi.mocked(storage.uploadUrl).mockResolvedValue({ path: 'p.png', token: 't', uploadUrl: 'u', visibility: 'public' });
		vi.mocked(storage.readUrl).mockResolvedValue('https://cdn/p.png');
		const app = createTestApp(routes, { path: '/profile', prisma, storage });
		const res = await app.request('/profile/avatar/upload-url', jsonRequest('POST', { mimeType: 'image/png', sizeBytes: 10 }));
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ data: { path: 'p.png', publicUrl: 'https://cdn/p.png', token: 't', uploadUrl: 'u', visibility: 'public' } });
		expect(storage.uploadUrl).toHaveBeenCalledWith('public', expect.stringMatching(new RegExp(`^${TEST_USER_ID}/avatar/[0-9a-f-]{36}\\.png$`)));
	});
});
