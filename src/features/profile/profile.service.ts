import type { PrismaClient, Profile, UserSettings } from '@usegonche/database';
import type { Storage, UploadUrl } from '@usegonche/storage';
import { changedFields, hasChanges } from '../../lib/diff.js';
import type { AvatarUploadInput, UpdateProfileInput, UpdateSettingsInput } from './profile.schemas.js';

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

const AVATAR_EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as const;

/**
 * Signed URL for the client to upload the avatar straight to the public bucket, plus the permanent public URL the file will have.
 * Nothing is saved yet: the client sends `publicUrl` as `avatarUrl` in `PATCH /profile` once the upload succeeds.
 * Every avatar lives under the owner's folder with a fresh name, so a new picture never serves a stale cached one.
 */
export const createAvatarUploadUrl = async (storage: Storage, ownerId: string, input: AvatarUploadInput): Promise<UploadUrl & { publicUrl: string }> => {
	const upload = await storage.uploadUrl('public', `${ownerId}/avatar/${crypto.randomUUID()}.${AVATAR_EXTENSIONS[input.mimeType]}`);
	return { ...upload, publicUrl: await storage.readUrl('public', upload.path) };
};
