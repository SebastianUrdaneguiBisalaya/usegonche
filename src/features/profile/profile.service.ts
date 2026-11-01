import type { PrismaClient, Profile, UserSettings } from '@usegonche/database';
import type { UpdateProfileInput, UpdateSettingsInput } from './profile.schemas.js';

/** Identity taken from the verified JWT claims (never from the request body). */
export type Identity = { email?: string; id: string };

export const DEFAULT_SETTINGS = { language: 'en', theme: 'system', timezone: 'UTC' } as const;

/** Returns the profile, creating it on first access (the sign-up trigger normally creates it first). */
export const getProfile = (prisma: PrismaClient, user: Identity): Promise<Profile> => prisma.profile.upsert({ create: { email: user.email, id: user.id }, update: {}, where: { id: user.id } });

export const updateProfile = (prisma: PrismaClient, user: Identity, input: UpdateProfileInput): Promise<Profile> =>
	prisma.profile.upsert({ create: { ...input, email: user.email, id: user.id }, update: input, where: { id: user.id } });

/** Returns the settings, creating them with defaults on first access (and the profile if it is still missing). */
export const getSettings = (prisma: PrismaClient, user: Identity): Promise<UserSettings> =>
	prisma.userSettings.upsert({
		create: { ...DEFAULT_SETTINGS, owner: { connectOrCreate: { create: { email: user.email, id: user.id }, where: { id: user.id } } } },
		update: {},
		where: { ownerId: user.id },
	});

export const updateSettings = (prisma: PrismaClient, user: Identity, input: UpdateSettingsInput): Promise<UserSettings> =>
	prisma.userSettings.upsert({
		create: { ...DEFAULT_SETTINGS, ...input, owner: { connectOrCreate: { create: { email: user.email, id: user.id }, where: { id: user.id } } } },
		update: input,
		where: { ownerId: user.id },
	});
