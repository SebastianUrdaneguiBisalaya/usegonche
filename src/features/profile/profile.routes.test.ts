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
	['GET', '/profile/getting-started'],
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

describe('PATCH /profile/settings (onboarding)', () => {
	it('completes it when everything is set (200)', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.userSettings.upsert).mockResolvedValue({ ...settings, country: 'PE' } as UserSettings);
		vi.mocked(prisma.userSettings.update).mockResolvedValue({ ...settings, country: 'PE', onboardingCompletedAt: new Date() } as UserSettings);
		const res = await app.request('/profile/settings', jsonRequest('PATCH', { onboardingCompleted: true }));
		expect(res.status).toBe(200);
		expect(prisma.userSettings.update).toHaveBeenCalledWith({ data: { onboardingCompletedAt: expect.any(Date) }, where: { ownerId: TEST_USER_ID } });
	});

	it('answers 422 with details while the country is missing', async () => {
		const { app } = setup();
		const res = await app.request('/profile/settings', jsonRequest('PATCH', { onboardingCompleted: true }));
		expect(res.status).toBe(422);
		expect(await res.json()).toMatchObject({ error: { code: 'validation_error', details: [{ code: 'onboarding_incomplete', field: 'country' }] } });
	});

	it('rejects `false` and unknown values', async () => {
		const { app } = setup();
		expect((await app.request('/profile/settings', jsonRequest('PATCH', { onboardingCompleted: false }))).status).toBe(422);
	});
});

describe('GET /profile/getting-started', () => {
	it('returns the steps done by the user from the claims', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.tag.findFirst).mockResolvedValue({ id: 't' } as never);
		const res = await app.request('/profile/getting-started');
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ data: { goal: false, plan: false, project: false, tag: true, task: false } });
		expect(prisma.tag.findFirst).toHaveBeenCalledWith({ select: { id: true }, where: { ownerId: TEST_USER_ID } });
	});
});

describe('PATCH /profile/settings (getting-started guide)', () => {
	it('marks the tour as completed (200)', async () => {
		const { app, prisma } = setup();
		vi.mocked(prisma.userSettings.update).mockResolvedValue({ ...settings, tourCompletedAt: new Date() } as UserSettings);
		const res = await app.request('/profile/settings', jsonRequest('PATCH', { tourCompleted: true }));
		expect(res.status).toBe(200);
		expect(prisma.userSettings.update).toHaveBeenCalledWith({ data: { tourCompletedAt: expect.any(Date) }, where: { ownerId: TEST_USER_ID } });
	});

	it('rejects `false` (422)', async () => {
		const { app } = setup();
		expect((await app.request('/profile/settings', jsonRequest('PATCH', { gettingStartedCompleted: false }))).status).toBe(422);
		expect((await app.request('/profile/settings', jsonRequest('PATCH', { tourCompleted: false }))).status).toBe(422);
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

	it.each(['system', 'es', 'es-PE'])('accepts %s as language', async language => {
		const { app, prisma } = setup();
		vi.mocked(prisma.userSettings.update).mockResolvedValue({ ...settings, language });
		const res = await app.request('/profile/settings', jsonRequest('PATCH', { language }));
		expect(res.status).toBe(200);
		expect(prisma.userSettings.update).toHaveBeenCalledWith({ data: { language }, where: { ownerId: TEST_USER_ID } });
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
		['a language that only looks like system', { language: 'systems' }],
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

describe('Google account avatar', () => {
	it('answers 403 on POST /profile/avatar/upload-url (its avatar is the Google picture)', async () => {
		const storage = createMockStorage();
		const app = createTestApp(routes, { path: '/profile', providers: ['google'], storage });
		const res = await app.request('/profile/avatar/upload-url', jsonRequest('POST', { mimeType: 'image/png', sizeBytes: 10 }));
		expect(res.status).toBe(403);
		expect(await res.json()).toMatchObject({ error: { code: 'forbidden' } });
		expect(storage.uploadUrl).not.toHaveBeenCalled();
	});

	it.each([[{ avatarUrl: 'https://cdn/x.png' }], [{ avatarUrl: null }]])('answers 403 on PATCH /profile changing or removing the avatar %j', async body => {
		const prisma = createMockPrisma();
		const app = createTestApp(routes, { path: '/profile', prisma, providers: ['google'] });
		const res = await app.request('/profile', jsonRequest('PATCH', body));
		expect(res.status).toBe(403);
		expect(await res.json()).toMatchObject({ error: { code: 'forbidden' } });
		expect(prisma.profile.update).not.toHaveBeenCalled();
	});

	it('still lets PATCH /profile update the other fields', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.profile.upsert).mockResolvedValue(profile);
		vi.mocked(prisma.profile.update).mockResolvedValue({ ...profile, displayName: 'Eva' });
		const app = createTestApp(routes, { path: '/profile', prisma, providers: ['google'] });
		const res = await app.request('/profile', jsonRequest('PATCH', { displayName: 'Eva' }));
		expect(res.status).toBe(200);
		expect(prisma.profile.update).toHaveBeenCalled();
	});
});

describe('PATCH /profile phoneNumber', () => {
	it.each(['987654321', '+0123456789', '+51 987 654 321', '+12', 'abc'])('rejects %j (not E.164)', async phoneNumber => {
		const { app, prisma } = setup();
		const res = await app.request('/profile', jsonRequest('PATCH', { phoneNumber }));
		expect(res.status).toBe(422);
		expect(await res.json()).toMatchObject({ error: { code: 'validation_error', details: [expect.objectContaining({ field: 'phoneNumber' })] } });
		expect(prisma.profile.update).not.toHaveBeenCalled();
	});

	it.each([
		['+51987654321', '+51987654321'],
		['', null],
		[null, null],
	])('saves %j as %j', async (phoneNumber, saved) => {
		const { app, prisma } = setup();
		// A different saved number, so every case is a change.
		vi.mocked(prisma.profile.upsert).mockResolvedValue({ ...profile, phoneNumber: '+14155550123' });
		vi.mocked(prisma.profile.update).mockResolvedValue({ ...profile, phoneNumber: saved });
		const res = await app.request('/profile', jsonRequest('PATCH', { phoneNumber }));
		expect(res.status).toBe(200);
		expect(prisma.profile.update).toHaveBeenCalledWith(expect.objectContaining({ data: { phoneNumber: saved } }));
	});
});
