import type { PrismaClient, Profile, UserSettings } from '@usegonche/database';
import type { Storage, UploadUrl } from '@usegonche/storage';
import { changedFields, hasChanges } from '../../lib/diff.js';
import { AppError } from '../../lib/errors.js';
import { scoped } from '../../lib/owner.js';
import { createOwnerUploadUrl } from '../../lib/upload-url.js';
import type { AvatarUploadInput, UpdateProfileInput, UpdateSettingsInput } from './profile.schemas.js';

/** Identity taken from the verified JWT claims (never from the request body). */
export type Identity = { email?: string; id: string };

export const DEFAULT_SETTINGS = { language: 'system', theme: 'system', timezone: 'UTC' } as const;

/** Returns the profile, creating it on first access (the sign-up trigger normally creates it first). */
export const getProfile = (prisma: PrismaClient, user: Identity): Promise<Profile> => prisma.profile.upsert({ create: { email: user.email, id: user.id }, update: {}, where: { id: user.id } });

/** Writes only what changed; an update that changes nothing answers with the current profile and writes nothing. */
export const updateProfile = async (prisma: PrismaClient, user: Identity, input: UpdateProfileInput): Promise<Profile> => {
	const current = await getProfile(prisma, user);
	const changed = changedFields(current, input);
	return hasChanges(changed) ? prisma.profile.update({ data: changed, where: { id: user.id } }) : current;
};

/**
 * Returns the settings, creating them with defaults on first access (and the profile if it is still missing).
 * Both upserts have no nested writes, so Prisma runs them as a single `INSERT ... ON CONFLICT`: a new account fires several requests at once
 * (root loader, layout, onboarding), and an upsert with a nested `connectOrCreate` is emulated as find-then-create, so the losing request
 * failed with P2014 trying to link the profile to a second settings row.
 */
export const getSettings = async (prisma: PrismaClient, user: Identity): Promise<UserSettings> => {
	await getProfile(prisma, user);
	return prisma.userSettings.upsert({ create: { ...DEFAULT_SETTINGS, ownerId: user.id }, update: {}, where: { ownerId: user.id } });
};

/** Writes only what changed; an update that changes nothing answers with the current settings and writes nothing. */
export const updateSettings = async (prisma: PrismaClient, user: Identity, { gettingStartedCompleted, onboardingCompleted, tourCompleted, ...input }: UpdateSettingsInput): Promise<UserSettings> => {
	const current = await getSettings(prisma, user);
	const changed: Partial<UserSettings> = changedFields(current, input);
	if (onboardingCompleted && !current.onboardingCompletedAt) {
		// Mandatory onboarding: everything it collects must be there once it is completed.
		const merged = { ...current, ...changed };
		const missing = (['theme', 'language', 'country', 'timezone'] as const).find(field => !merged[field]);
		if (missing) throw new AppError('validation_error', 422, [{ code: 'onboarding_incomplete', field: missing }]);
		changed.onboardingCompletedAt = new Date();
	}
	// One-way flags of the first-run guide: the first date is kept.
	if (tourCompleted && !current.tourCompletedAt) changed.tourCompletedAt = new Date();
	if (gettingStartedCompleted && !current.gettingStartedCompletedAt) changed.gettingStartedCompletedAt = new Date();
	return hasChanges(changed) ? prisma.userSettings.update({ data: changed, where: { ownerId: user.id } }) : current;
};

/** Steps of the getting-started checklist, in the order it shows them: each is done once the user has created at least one. */
export interface GettingStartedProgress {
	goal: boolean;
	plan: boolean;
	project: boolean;
	tag: boolean;
	task: boolean;
}

/** Which getting-started steps are done, from the user's own data (archived goals and projects still count: they were created). */
export const getGettingStarted = async (prisma: PrismaClient, ownerId: string): Promise<GettingStartedProgress> => {
	const select = { id: true } as const;
	const [tag, goal, project, task, plan] = await Promise.all([
		prisma.tag.findFirst({ select, where: scoped(ownerId) }),
		prisma.goal.findFirst({ select, where: scoped(ownerId) }),
		prisma.project.findFirst({ select, where: scoped(ownerId) }),
		prisma.task.findFirst({ select, where: scoped(ownerId) }),
		prisma.dailyPlanItem.findFirst({ select, where: scoped(ownerId) }),
	]);
	return { goal: Boolean(goal), plan: Boolean(plan), project: Boolean(project), tag: Boolean(tag), task: Boolean(task) };
};

/** What deleting an account needs besides the database: storage with access to every file of the user and the Supabase Auth admin. */
export interface AccountRemoval {
	deleteAuthUser: (id: string) => Promise<void>;
	storage: Storage;
}

const REMOVE_BATCH = 1000;

/**
 * Deletes the account and everything in it, in an order that can be retried: first every file under the user's storage folder (both buckets),
 * then the profile (every user-owned table cascades from it), and last the Supabase Auth user (sessions and identities go with it).
 * If a step fails nothing after it runs, so the user is still signed in and can try again.
 */
export const deleteAccount = async (prisma: PrismaClient, ownerId: string, { deleteAuthUser, storage }: AccountRemoval): Promise<void> => {
	for (const visibility of ['private', 'public'] as const) {
		const paths = await storage.listAll(visibility, ownerId);
		for (let start = 0; start < paths.length; start += REMOVE_BATCH) await storage.remove(visibility, paths.slice(start, start + REMOVE_BATCH));
	}
	await prisma.profile.deleteMany({ where: { id: ownerId } });
	await deleteAuthUser(ownerId);
};

const AVATAR_EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as const;

/**
 * Signed URL for the client to upload the avatar straight to the public bucket, plus the permanent public URL the file will have.
 * Nothing is saved yet: the client sends `publicUrl` as `avatarUrl` in `PATCH /profile` once the upload succeeds.
 * Every avatar lives under the owner's folder with a fresh name, so a new picture never serves a stale cached one.
 */
export const createAvatarUploadUrl = async (storage: Storage, ownerId: string, input: AvatarUploadInput): Promise<UploadUrl & { publicUrl: string }> => {
	const upload = await createOwnerUploadUrl(storage, ownerId, { extension: AVATAR_EXTENSIONS[input.mimeType], folder: 'avatar', visibility: 'public' });
	return { ...upload, publicUrl: await storage.readUrl('public', upload.path) };
};
