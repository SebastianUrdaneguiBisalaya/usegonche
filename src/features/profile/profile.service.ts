import type { PrismaClient, Profile, UserSettings } from '@usegonche/database';
import { changedFields, hasChanges } from '../../lib/diff.js';
import type { UpdateProfileInput, UpdateSettingsInput } from './profile.schemas.js';

/** Identity taken from the verified JWT claims (never from the request body). */
export type Identity = { email?: string; id: string };

export const DEFAULT_SETTINGS = { language: 'en', theme: 'system', timezone: 'UTC' } as const;

/** Returns the profile, creating it on first access (the sign-up trigger normally creates it first). */
export const getProfile = (prisma: PrismaClient, user: Identity): Promise<Profile> => prisma.profile.upsert({ create: { email: user.email, id: user.id }, update: {}, where: { id: user.id } });

/** Writes only what changed; an update that changes nothing answers with the current profile and writes nothing. */
export const updateProfile = async (prisma: PrismaClient, user: Identity, input: UpdateProfileInput): Promise<Profile> => {
	const current = await getProfile(prisma, user);
	const changed = changedFields(current, input);
	return hasChanges(changed) ? prisma.profile.update({ data: changed, where: { id: user.id } }) : current;
};

/** Returns the settings, creating them with defaults on first access (and the profile if it is still missing). */
export const getSettings = (prisma: PrismaClient, user: Identity): Promise<UserSettings> =>
	prisma.userSettings.upsert({
		create: { ...DEFAULT_SETTINGS, owner: { connectOrCreate: { create: { email: user.email, id: user.id }, where: { id: user.id } } } },
		update: {},
		where: { ownerId: user.id },
	});

/** Writes only what changed; an update that changes nothing answers with the current settings and writes nothing. */
export const updateSettings = async (prisma: PrismaClient, user: Identity, input: UpdateSettingsInput): Promise<UserSettings> => {
	const current = await getSettings(prisma, user);
	const changed = changedFields(current, input);
	return hasChanges(changed) ? prisma.userSettings.update({ data: changed, where: { ownerId: user.id } }) : current;
};
