import type { Profile, UserSettings } from '@usegonche/database';
import { describe, expect, it, vi } from 'vitest';
import { createMockPrisma, createMockStorage, OTHER_USER_ID, TEST_USER_ID } from '../../test/helpers.js';
import { createAvatarUploadUrl, DEFAULT_SETTINGS, getGettingStarted, getProfile, getSettings, updateProfile, updateSettings } from './profile.service.js';

const user = { email: 'me@example.com', id: TEST_USER_ID };
const profile = { email: user.email, id: TEST_USER_ID } as Profile;
const settings = { id: 'settings-id', ownerId: TEST_USER_ID, ...DEFAULT_SETTINGS } as unknown as UserSettings;

describe('getProfile', () => {
	it('upserts by the authenticated user id and creates it on first access', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.profile.upsert).mockResolvedValue(profile);

		expect(await getProfile(prisma, user)).toBe(profile);
		expect(prisma.profile.upsert).toHaveBeenCalledWith({ create: { email: user.email, id: TEST_USER_ID }, update: {}, where: { id: TEST_USER_ID } });
	});

	it('never targets another user', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.profile.upsert).mockResolvedValue(profile);
		await getProfile(prisma, user);
		expect(JSON.stringify(vi.mocked(prisma.profile.upsert).mock.calls)).not.toContain(OTHER_USER_ID);
	});
});

describe('updateProfile', () => {
	it('updates only the given fields for the user', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.profile.upsert).mockResolvedValue(profile);
		vi.mocked(prisma.profile.update).mockResolvedValue({ ...profile, displayName: 'Ana' });

		expect(await updateProfile(prisma, user, { displayName: 'Ana', bio: null })).toMatchObject({ displayName: 'Ana' });
		expect(prisma.profile.update).toHaveBeenCalledWith({ data: { displayName: 'Ana' }, where: { id: TEST_USER_ID } });
	});

	it('is idempotent: sending the stored values answers the profile and writes nothing', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.profile.upsert).mockResolvedValue({ ...profile, displayName: 'Ana' });
		const result = await updateProfile(prisma, user, { bio: null, displayName: 'Ana' });
		expect(result).toMatchObject({ displayName: 'Ana' });
		expect(prisma.profile.update).not.toHaveBeenCalled();
	});
});

describe('getSettings', () => {
	it('creates default settings (and the profile if missing) on first access', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.userSettings.upsert).mockResolvedValue(settings);

		expect(await getSettings(prisma, user)).toBe(settings);
		expect(prisma.profile.upsert).toHaveBeenCalledWith({ create: { email: user.email, id: TEST_USER_ID }, update: {}, where: { id: TEST_USER_ID } });
		// No nested writes, so Prisma runs it as a native `INSERT ... ON CONFLICT` (safe when several first requests race).
		expect(prisma.userSettings.upsert).toHaveBeenCalledWith({ create: { ...DEFAULT_SETTINGS, ownerId: TEST_USER_ID }, update: {}, where: { ownerId: TEST_USER_ID } });
		expect(vi.mocked(prisma.profile.upsert).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(prisma.userSettings.upsert).mock.invocationCallOrder[0] ?? 0);
	});
});

describe('updateSettings', () => {
	it('overrides defaults on create and updates only the given fields', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.userSettings.upsert).mockResolvedValue(settings);
		vi.mocked(prisma.userSettings.update).mockResolvedValue({ ...settings, theme: 'dark', timezone: 'America/Lima' });

		await updateSettings(prisma, user, { language: 'system', theme: 'dark', timezone: 'America/Lima' });
		expect(prisma.userSettings.update).toHaveBeenCalledWith({ data: { theme: 'dark', timezone: 'America/Lima' }, where: { ownerId: TEST_USER_ID } });
	});

	it('creates the defaults on first access and writes nothing when the values are the defaults', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.userSettings.upsert).mockResolvedValue(settings);
		expect(await updateSettings(prisma, user, { theme: 'system' })).toBe(settings);
		expect(prisma.userSettings.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: {}, where: { ownerId: TEST_USER_ID } }));
		expect(prisma.userSettings.update).not.toHaveBeenCalled();
	});
});

describe('updateSettings (onboarding)', () => {
	const ready = { ...settings, country: 'PE' } as UserSettings;

	it('completes the onboarding once theme, language, country and time zone are set', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.userSettings.upsert).mockResolvedValue(settings);
		vi.mocked(prisma.userSettings.update).mockResolvedValue({ ...ready, onboardingCompletedAt: new Date() });
		await updateSettings(prisma, user, { country: 'PE', onboardingCompleted: true });
		expect(prisma.userSettings.update).toHaveBeenCalledWith({ data: { country: 'PE', onboardingCompletedAt: expect.any(Date) }, where: { ownerId: TEST_USER_ID } });
	});

	it('answers 422 `onboarding_incomplete` for the first missing field and writes nothing', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.userSettings.upsert).mockResolvedValue(settings);
		await expect(updateSettings(prisma, user, { onboardingCompleted: true })).rejects.toMatchObject({
			code: 'validation_error',
			details: [{ code: 'onboarding_incomplete', field: 'country' }],
			status: 422,
		});
		expect(prisma.userSettings.update).not.toHaveBeenCalled();
	});

	it('is idempotent: an already completed onboarding keeps its date', async () => {
		const prisma = createMockPrisma();
		const done = { ...ready, onboardingCompletedAt: new Date('2026-11-01T00:00:00Z') } as UserSettings;
		vi.mocked(prisma.userSettings.upsert).mockResolvedValue(done);
		expect(await updateSettings(prisma, user, { onboardingCompleted: true })).toBe(done);
		expect(prisma.userSettings.update).not.toHaveBeenCalled();
	});
});

describe('updateSettings (getting-started guide)', () => {
	it('marks the tour and the checklist as completed', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.userSettings.upsert).mockResolvedValue(settings);
		vi.mocked(prisma.userSettings.update).mockResolvedValue(settings);
		await updateSettings(prisma, user, { gettingStartedCompleted: true, tourCompleted: true });
		expect(prisma.userSettings.update).toHaveBeenCalledWith({
			data: { gettingStartedCompletedAt: expect.any(Date), tourCompletedAt: expect.any(Date) },
			where: { ownerId: TEST_USER_ID },
		});
	});

	it('is idempotent: already completed flags keep their date and write nothing', async () => {
		const prisma = createMockPrisma();
		const done = { ...settings, gettingStartedCompletedAt: new Date('2026-11-01T00:00:00Z'), tourCompletedAt: new Date('2026-11-01T00:00:00Z') } as UserSettings;
		vi.mocked(prisma.userSettings.upsert).mockResolvedValue(done);
		expect(await updateSettings(prisma, user, { gettingStartedCompleted: true, tourCompleted: true })).toBe(done);
		expect(prisma.userSettings.update).not.toHaveBeenCalled();
	});
});

describe('getGettingStarted', () => {
	it('reports each step as done when the user has at least one of it', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.tag.findFirst).mockResolvedValue({ id: 't' } as never);
		vi.mocked(prisma.goal.findFirst).mockResolvedValue({ id: 'g' } as never);
		vi.mocked(prisma.project.findFirst).mockResolvedValue(null);
		vi.mocked(prisma.task.findFirst).mockResolvedValue(null);
		vi.mocked(prisma.dailyPlanItem.findFirst).mockResolvedValue(null);
		expect(await getGettingStarted(prisma, TEST_USER_ID)).toEqual({ goal: true, plan: false, project: false, tag: true, task: false });
	});

	it('scopes every lookup to the owner', async () => {
		const prisma = createMockPrisma();
		await getGettingStarted(prisma, TEST_USER_ID);
		for (const model of [prisma.tag, prisma.goal, prisma.project, prisma.task, prisma.dailyPlanItem]) {
			expect(model.findFirst).toHaveBeenCalledWith({ select: { id: true }, where: { ownerId: TEST_USER_ID } });
		}
		expect(JSON.stringify(vi.mocked(prisma.task.findFirst).mock.calls)).not.toContain(OTHER_USER_ID);
	});
});

describe('createAvatarUploadUrl', () => {
	it.each([
		['image/png', 'png'],
		['image/jpeg', 'jpg'],
		['image/webp', 'webp'],
	] as const)('uploads %s to the public bucket under the owner folder and returns the public url', async (mimeType, extension) => {
		const storage = createMockStorage();
		vi.mocked(storage.uploadUrl).mockResolvedValue({ path: 'the/path', token: 't', uploadUrl: 'u', visibility: 'public' });
		vi.mocked(storage.readUrl).mockResolvedValue('https://cdn/the/path');

		const result = await createAvatarUploadUrl(storage, TEST_USER_ID, { mimeType, sizeBytes: 10 });

		expect(storage.uploadUrl).toHaveBeenCalledWith('public', expect.stringMatching(new RegExp(`^${TEST_USER_ID}/avatar/[0-9a-f-]{36}\\.${extension}$`)));
		expect(storage.readUrl).toHaveBeenCalledWith('public', 'the/path');
		expect(result).toEqual({ path: 'the/path', publicUrl: 'https://cdn/the/path', token: 't', uploadUrl: 'u', visibility: 'public' });
	});

	it('uses a fresh path every time', async () => {
		const storage = createMockStorage();
		vi.mocked(storage.uploadUrl).mockResolvedValue({ path: 'p', token: 't', uploadUrl: 'u', visibility: 'public' });
		vi.mocked(storage.readUrl).mockResolvedValue('x');
		await createAvatarUploadUrl(storage, TEST_USER_ID, { mimeType: 'image/png', sizeBytes: 1 });
		await createAvatarUploadUrl(storage, TEST_USER_ID, { mimeType: 'image/png', sizeBytes: 1 });
		const [first, second] = vi.mocked(storage.uploadUrl).mock.calls;
		expect(first?.[1]).not.toBe(second?.[1]);
	});
});
