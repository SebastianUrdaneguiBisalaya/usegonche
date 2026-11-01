import type { Profile, UserSettings } from '@usegonche/database';
import { describe, expect, it, vi } from 'vitest';
import { createMockPrisma, OTHER_USER_ID, TEST_USER_ID } from '../../test/helpers.js';
import { DEFAULT_SETTINGS, getProfile, getSettings, updateProfile, updateSettings } from './profile.service.js';

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
		expect(prisma.userSettings.upsert).toHaveBeenCalledWith({
			create: { ...DEFAULT_SETTINGS, owner: { connectOrCreate: { create: { email: user.email, id: TEST_USER_ID }, where: { id: TEST_USER_ID } } } },
			update: {},
			where: { ownerId: TEST_USER_ID },
		});
	});
});

describe('updateSettings', () => {
	it('overrides defaults on create and updates only the given fields', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.userSettings.upsert).mockResolvedValue(settings);
		vi.mocked(prisma.userSettings.update).mockResolvedValue({ ...settings, theme: 'dark', timezone: 'America/Lima' });

		await updateSettings(prisma, user, { language: 'en', theme: 'dark', timezone: 'America/Lima' });
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
