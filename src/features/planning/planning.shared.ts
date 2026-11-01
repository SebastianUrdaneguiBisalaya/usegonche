import type { AvailabilityWindow, Prisma, PrismaClient } from '@usegonche/database';
import { scoped } from '../../lib/owner.js';

export type Db = PrismaClient | Prisma.TransactionClient;

/** The user's IANA timezone (`user_settings.timezone`), UTC when never set. Day boundaries always use it. */
export const getTimeZone = async (prisma: Db, ownerId: string): Promise<string> => (await prisma.userSettings.findUnique({ select: { timezone: true }, where: { ownerId } }))?.timezone ?? 'UTC';

export const getWindows = (prisma: Db, ownerId: string): Promise<AvailabilityWindow[]> =>
	prisma.availabilityWindow.findMany({ orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }], where: scoped(ownerId) });

export const CLOSED_TASK = ['done', 'cancelled'] as const;
