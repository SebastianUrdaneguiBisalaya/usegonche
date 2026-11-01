import type { PrismaClient, Profile } from '@usegonche/database';

export type AuthUser = { email?: string; id: string };

export const publicUser = (user: AuthUser) => ({ email: user.email, id: user.id });

/** Keeps the app profile in sync after every sign-in (also creates it on the first Google sign-in). */
export const syncProfile = (prisma: PrismaClient, user: AuthUser): Promise<Profile> =>
	prisma.profile.upsert({
		create: { email: user.email, id: user.id },
		update: { email: user.email },
		where: { id: user.id },
	});
