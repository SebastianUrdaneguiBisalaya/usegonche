import type { PrismaClient, Profile } from '@usegonche/database';

export const getProfile = (prisma: PrismaClient, userId: string): Promise<Profile | null> => prisma.profile.findUnique({ where: { id: userId } });
