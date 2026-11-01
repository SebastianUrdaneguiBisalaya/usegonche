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

		await updateProfile(prisma, user, { displayName: 'Ana', bio: null });
		expect(prisma.profile.upsert).toHaveBeenCalledWith({
			create: { bio: null, displayName: 'Ana', email: user.email, id: TEST_USER_ID },
			update: { bio: null, displayName: 'Ana' },
			where: { id: TEST_USER_ID },
		});
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

		await updateSettings(prisma, user, { theme: 'dark', timezone: 'America/Lima' });
		const args = vi.mocked(prisma.userSettings.upsert).mock.calls[0]?.[0];
		expect(args?.update).toEqual({ theme: 'dark', timezone: 'America/Lima' });
		expect(args?.create).toMatchObject({ language: 'en', theme: 'dark', timezone: 'America/Lima' });
		expect(args?.where).toEqual({ ownerId: TEST_USER_ID });
	});
});
