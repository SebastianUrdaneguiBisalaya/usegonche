import type { AvailabilityWindow } from '@usegonche/database';
import { describe, expect, it, vi } from 'vitest';
import { createMockPrisma, OTHER_USER_ID, TEST_USER_ID } from '../../test/helpers.js';
import { getAvailability, setAvailability } from './planning.availability.service.js';

const windows = [
	{ endMinute: 1020, id: 'a', ownerId: TEST_USER_ID, startMinute: 540, weekday: 1 },
	{ endMinute: 720, id: 'b', ownerId: TEST_USER_ID, startMinute: 540, weekday: 2 },
] as AvailabilityWindow[];

describe('getAvailability', () => {
	it('returns the windows, the weekly total and the timezone (UTC by default)', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.availabilityWindow.findMany).mockResolvedValue(windows);
		expect(await getAvailability(prisma, TEST_USER_ID)).toEqual({ timezone: 'UTC', weeklyMinutes: 480 + 180, windows });
		expect(prisma.availabilityWindow.findMany).toHaveBeenCalledWith({ orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }], where: { ownerId: TEST_USER_ID } });
	});

	it('uses the timezone from the user settings', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.userSettings.findUnique).mockResolvedValue({ timezone: 'America/Lima' } as never);
		vi.mocked(prisma.availabilityWindow.findMany).mockResolvedValue([]);
		expect(await getAvailability(prisma, TEST_USER_ID)).toMatchObject({ timezone: 'America/Lima', weeklyMinutes: 0 });
		expect(prisma.userSettings.findUnique).toHaveBeenCalledWith({ select: { timezone: true }, where: { ownerId: TEST_USER_ID } });
	});
});

describe('setAvailability', () => {
	it('replaces the whole template for the owner', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.availabilityWindow.findMany).mockResolvedValue(windows);
		await setAvailability(prisma, TEST_USER_ID, [{ endMinute: 1020, startMinute: 540, weekday: 1 }]);
		expect(prisma.availabilityWindow.deleteMany).toHaveBeenCalledWith({ where: { ownerId: TEST_USER_ID } });
		expect(prisma.availabilityWindow.createMany).toHaveBeenCalledWith({ data: [{ endMinute: 1020, ownerId: TEST_USER_ID, startMinute: 540, weekday: 1 }] });
	});

	it('clears the template with an empty list and never touches another owner', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.availabilityWindow.findMany).mockResolvedValue(windows);
		await setAvailability(prisma, OTHER_USER_ID, []);
		expect(prisma.availabilityWindow.deleteMany).toHaveBeenCalledWith({ where: { ownerId: OTHER_USER_ID } });
		expect(prisma.availabilityWindow.createMany).not.toHaveBeenCalled();
	});

	it('is idempotent: the template that is already stored (any order) is not rewritten', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.availabilityWindow.findMany).mockResolvedValue(windows);
		const result = await setAvailability(prisma, TEST_USER_ID, [
			{ endMinute: 720, startMinute: 540, weekday: 2 },
			{ endMinute: 1020, startMinute: 540, weekday: 1 },
		]);
		expect(result.windows).toBe(windows);
		expect(prisma.availabilityWindow.deleteMany).not.toHaveBeenCalled();
		expect(prisma.availabilityWindow.createMany).not.toHaveBeenCalled();
	});

	it('clearing an already empty template writes nothing', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.availabilityWindow.findMany).mockResolvedValue([]);
		await setAvailability(prisma, TEST_USER_ID, []);
		expect(prisma.availabilityWindow.deleteMany).not.toHaveBeenCalled();
	});
});
