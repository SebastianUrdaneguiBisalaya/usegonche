import type { AvailabilityWindow, PrismaClient } from '@usegonche/database';
import { scoped } from '../../lib/owner.js';
import type { AvailabilityInput } from './planning.schemas.js';
import { getTimeZone, getWindows } from './planning.shared.js';

export type Availability = { timezone: string; weeklyMinutes: number; windows: AvailabilityWindow[] };

const toAvailability = (timezone: string, windows: AvailabilityWindow[]): Availability => ({
	timezone,
	weeklyMinutes: windows.reduce((total, window) => total + window.endMinute - window.startMinute, 0),
	windows,
});

export const getAvailability = async (prisma: PrismaClient, ownerId: string): Promise<Availability> => toAvailability(await getTimeZone(prisma, ownerId), await getWindows(prisma, ownerId));

/** Replaces the whole weekly template (send an empty list to clear it). Minutes are local to the user's timezone. */
export const setAvailability = (prisma: PrismaClient, ownerId: string, windows: AvailabilityInput): Promise<Availability> =>
	prisma.$transaction(async tx => {
		await tx.availabilityWindow.deleteMany({ where: scoped(ownerId) });
		if (windows.length > 0) await tx.availabilityWindow.createMany({ data: windows.map(window => ({ ...window, ownerId })) });
		return toAvailability(await getTimeZone(tx, ownerId), await getWindows(tx, ownerId));
	});
