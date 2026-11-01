import type { TimeBlock } from '@usegonche/database';
import { describe, expect, it, vi } from 'vitest';
import { createMockPrisma, OTHER_USER_ID, TEST_USER_ID } from '../../test/helpers.js';
import { createBlock, deleteBlock, detectWarnings, getBlock, listBlocks, moveBlock, updateBlock } from './planning.blocks.service.js';

const ID = '5d1f0c2e-7a34-4b9e-8c61-2f3a4b5c6d7e';
const NEW_ID = '9b7e4a10-3c52-4d8f-a1e6-0f2d3c4b5a69';
const TASK = 'c4d5e6f7-1a2b-4c3d-8e9f-a0b1c2d3e4f5';
const at = (time: string) => new Date(`2026-11-02T${time}:00Z`); // Monday, UTC
const monday9to5 = [{ endMinute: 1020, startMinute: 540, weekday: 1 }];
const block = (extra: object = {}) =>
	({
		actualEnd: null,
		actualStart: null,
		id: ID,
		ownerId: TEST_USER_ID,
		plannedEnd: at('11:00'),
		plannedStart: at('10:00'),
		rescheduledFromId: null,
		status: 'planned',
		taskId: TASK,
		title: null,
		...extra,
	}) as TimeBlock;

// biome-ignore lint/suspicious/noExplicitAny: the mock rows are partial on purpose
const asRow = (value: unknown): any => value;
const rejection = (promise: Promise<unknown>) =>
	promise.then(
		() => null,
		(e: unknown) => e
	);

const setup = ({ blocks = [], events = [], windows = monday9to5 }: { blocks?: unknown[]; events?: unknown[]; windows?: unknown[] } = {}) => {
	const prisma = createMockPrisma();
	vi.mocked(prisma.timeBlock.findMany).mockResolvedValue(asRow(blocks));
	vi.mocked(prisma.calendarEvent.findMany).mockResolvedValue(asRow(events));
	vi.mocked(prisma.availabilityWindow.findMany).mockResolvedValue(asRow(windows));
	return prisma;
};

describe('detectWarnings', () => {
	it('has no warnings inside working hours with nothing else around', async () => {
		expect(await detectWarnings(setup(), TEST_USER_ID, at('10:00'), at('11:00'))).toEqual([]);
	});

	it('warns about overlapping planned blocks (excluding itself) with the conflicting id', async () => {
		const prisma = setup({ blocks: [{ id: NEW_ID, plannedEnd: at('10:30'), plannedStart: at('09:30') }] });
		expect(await detectWarnings(prisma, TEST_USER_ID, at('10:00'), at('11:00'), ID)).toEqual([{ code: 'overlaps_block', refId: NEW_ID }]);
		expect(prisma.timeBlock.findMany).toHaveBeenCalledWith(
			expect.objectContaining({ where: { id: { not: ID }, ownerId: TEST_USER_ID, plannedEnd: { gt: at('10:00') }, plannedStart: { lt: at('11:00') }, status: 'planned' } })
		);
	});

	it('does not warn for blocks that only touch', async () => {
		const prisma = setup({ blocks: [{ id: NEW_ID, plannedEnd: at('10:00'), plannedStart: at('09:00') }] });
		expect(await detectWarnings(prisma, TEST_USER_ID, at('10:00'), at('11:00'))).toEqual([]);
	});

	it('warns about busy events but not about plain all-day ones', async () => {
		const busy = { allDay: false, endsAt: at('10:30'), id: 'e1', kind: 'event', startsAt: at('10:00') };
		const info = { allDay: true, endsAt: at('23:59'), id: 'e2', kind: 'event', startsAt: at('00:00') };
		expect(await detectWarnings(setup({ events: [busy, info] }), TEST_USER_ID, at('10:00'), at('11:00'))).toEqual([{ code: 'overlaps_event', refId: 'e1' }]);
	});

	it('warns when any part is outside the working hours', async () => {
		expect(await detectWarnings(setup(), TEST_USER_ID, at('16:30'), at('17:30'))).toEqual([{ code: 'outside_availability' }]);
		expect(await detectWarnings(setup({ windows: [] }), TEST_USER_ID, at('10:00'), at('11:00'))).toEqual([{ code: 'outside_availability' }]);
	});
});

describe('createBlock', () => {
	it('creates a block for an open task and returns the warnings', async () => {
		const prisma = setup();
		vi.mocked(prisma.task.findFirst).mockResolvedValue(asRow({ status: 'todo' }));
		vi.mocked(prisma.timeBlock.create).mockResolvedValue(block());
		const result = await createBlock(prisma, TEST_USER_ID, { plannedEnd: at('11:00'), plannedStart: at('10:00'), taskId: TASK });
		expect(result).toMatchObject({ id: ID, warnings: [] });
		expect(prisma.task.findFirst).toHaveBeenCalledWith({ select: { status: true }, where: { id: TASK, ownerId: TEST_USER_ID } });
		expect(prisma.timeBlock.create).toHaveBeenCalledWith({ data: { ownerId: TEST_USER_ID, plannedEnd: at('11:00'), plannedStart: at('10:00'), taskId: TASK, title: undefined } });
	});

	it('creates a task-less block with a title', async () => {
		const prisma = setup();
		vi.mocked(prisma.timeBlock.create).mockResolvedValue(block({ taskId: null, title: 'Lunch' }));
		await createBlock(prisma, TEST_USER_ID, { plannedEnd: at('11:00'), plannedStart: at('10:00'), title: 'Lunch' });
		expect(prisma.task.findFirst).not.toHaveBeenCalled();
	});

	it.each([
		['done', 'task_closed'],
		['cancelled', 'task_closed'],
	])('rejects a %s task', async (status, code) => {
		const prisma = setup();
		vi.mocked(prisma.task.findFirst).mockResolvedValue(asRow({ status }));
		expect(await rejection(createBlock(prisma, TEST_USER_ID, { plannedEnd: at('11:00'), plannedStart: at('10:00'), taskId: TASK }))).toMatchObject({
			details: [{ code, field: 'taskId' }],
			status: 422,
		});
		expect(prisma.timeBlock.create).not.toHaveBeenCalled();
	});

	it('rejects a task that is not the owner’s', async () => {
		const prisma = setup();
		vi.mocked(prisma.task.findFirst).mockResolvedValue(null);
		expect(await rejection(createBlock(prisma, OTHER_USER_ID, { plannedEnd: at('11:00'), plannedStart: at('10:00'), taskId: TASK }))).toMatchObject({
			details: [{ code: 'not_found', field: 'taskId' }],
		});
	});

	it('still creates the block when there are conflicts, reporting them', async () => {
		const prisma = setup({ blocks: [{ id: NEW_ID, plannedEnd: at('10:30'), plannedStart: at('10:00') }] });
		vi.mocked(prisma.timeBlock.create).mockResolvedValue(block({ taskId: null, title: 'x' }));
		expect((await createBlock(prisma, TEST_USER_ID, { plannedEnd: at('11:00'), plannedStart: at('10:00'), title: 'x' })).warnings).toEqual([{ code: 'overlaps_block', refId: NEW_ID }]);
	});
});

describe('listBlocks / getBlock', () => {
	it('lists blocks of the local days, optionally by status, scoped by owner', async () => {
		const prisma = setup({ blocks: [block()] });
		expect(await listBlocks(prisma, TEST_USER_ID, '2026-11-02', '2026-11-03', 'missed')).toHaveLength(1);
		expect(prisma.timeBlock.findMany).toHaveBeenCalledWith({
			orderBy: [{ plannedStart: 'asc' }, { id: 'asc' }],
			where: { ownerId: TEST_USER_ID, plannedEnd: { gt: new Date('2026-11-02T00:00:00Z') }, plannedStart: { lt: new Date('2026-11-04T00:00:00Z') }, status: 'missed' },
		});
	});

	it('throws 404 for another owner', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.timeBlock.findFirst).mockResolvedValue(null);
		expect(await rejection(getBlock(prisma, OTHER_USER_ID, ID))).toMatchObject({ code: 'not_found', status: 404 });
	});
});

describe('updateBlock', () => {
	const setupUpdate = (current: TimeBlock) => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.timeBlock.findFirst).mockResolvedValue(current);
		return prisma;
	};
	const dataOf = (prisma: ReturnType<typeof createMockPrisma>) => vi.mocked(prisma.timeBlock.updateMany).mock.calls[0]?.[0]?.data;

	it('marks a planned block done with the planned times as actuals by default', async () => {
		const prisma = setupUpdate(block());
		await updateBlock(prisma, TEST_USER_ID, ID, { status: 'done' });
		expect(dataOf(prisma)).toEqual({ actualEnd: at('11:00'), actualStart: at('10:00'), status: 'done' });
		expect(prisma.timeBlock.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: ID, ownerId: TEST_USER_ID } }));
	});

	it('marks done with the real times', async () => {
		const prisma = setupUpdate(block());
		await updateBlock(prisma, TEST_USER_ID, ID, { actualEnd: at('11:20'), actualStart: at('10:05'), status: 'done' });
		expect(dataOf(prisma)).toEqual({ actualEnd: at('11:20'), actualStart: at('10:05'), status: 'done' });
	});

	it('marks missed without actuals and rejects actuals for missed', async () => {
		const prisma = setupUpdate(block());
		await updateBlock(prisma, TEST_USER_ID, ID, { status: 'missed' });
		expect(dataOf(prisma)).toEqual({ status: 'missed' });
		expect(await rejection(updateBlock(prisma, TEST_USER_ID, ID, { actualStart: at('10:00'), status: 'missed' }))).toMatchObject({ status: 422 });
	});

	it('marks interrupted with both actual times', async () => {
		const prisma = setupUpdate(block());
		await updateBlock(prisma, TEST_USER_ID, ID, { actualEnd: at('10:20'), actualStart: at('10:00'), status: 'interrupted' });
		expect(dataOf(prisma)).toEqual({ actualEnd: at('10:20'), actualStart: at('10:00'), status: 'interrupted' });
	});

	it('answers 409 when closing a block that is not planned', async () => {
		const prisma = setupUpdate(block({ status: 'done' }));
		expect(await rejection(updateBlock(prisma, TEST_USER_ID, ID, { status: 'missed' }))).toMatchObject({ code: 'invalid_state', status: 409 });
		expect(prisma.timeBlock.updateMany).not.toHaveBeenCalled();
	});

	it('edits the actual times of a done block but not of a planned one', async () => {
		const done = setupUpdate(block({ actualEnd: at('11:00'), actualStart: at('10:00'), status: 'done' }));
		await updateBlock(done, TEST_USER_ID, ID, { actualEnd: at('11:30') });
		expect(dataOf(done)).toEqual({ actualEnd: at('11:30'), actualStart: undefined });

		const planned = setupUpdate(block());
		expect(await rejection(updateBlock(planned, TEST_USER_ID, ID, { actualEnd: at('11:30') }))).toMatchObject({ status: 409 });
	});

	it('rejects actual end before start against stored values', async () => {
		const prisma = setupUpdate(block({ actualEnd: at('11:00'), actualStart: at('10:00'), status: 'done' }));
		expect(await rejection(updateBlock(prisma, TEST_USER_ID, ID, { actualEnd: at('09:00') }))).toMatchObject({ details: [{ code: 'end_before_start', field: 'actualEnd' }], status: 422 });
	});

	it('renames in any state and throws 404 for another owner', async () => {
		const prisma = setupUpdate(block({ status: 'done' }));
		await updateBlock(prisma, TEST_USER_ID, ID, { title: 'New' });
		expect(dataOf(prisma)).toEqual({ title: 'New' });

		vi.mocked(prisma.timeBlock.findFirst).mockResolvedValue(null);
		expect(await rejection(updateBlock(prisma, OTHER_USER_ID, ID, { title: 'x' }))).toMatchObject({ status: 404 });
	});
});

describe('moveBlock', () => {
	const setupMove = (current: TimeBlock, taskStatus = 'todo') => {
		const prisma = setup();
		vi.mocked(prisma.timeBlock.findFirst).mockResolvedValue(current);
		vi.mocked(prisma.timeBlock.count).mockResolvedValue(0);
		vi.mocked(prisma.task.findFirst).mockResolvedValue(asRow({ status: taskStatus }));
		vi.mocked(prisma.timeBlock.create).mockResolvedValue(block({ id: NEW_ID, rescheduledFromId: ID }));
		return prisma;
	};
	const range = { plannedEnd: at('15:00'), plannedStart: at('14:00') };

	it('creates a new block linked to the old one and marks a planned original as rescheduled', async () => {
		const prisma = setupMove(block());
		const result = await moveBlock(prisma, TEST_USER_ID, ID, range);
		expect(result).toMatchObject({ id: NEW_ID, rescheduledFromId: ID });
		expect(prisma.timeBlock.create).toHaveBeenCalledWith({ data: { ownerId: TEST_USER_ID, ...range, rescheduledFromId: ID, taskId: TASK, title: null } });
		expect(prisma.timeBlock.updateMany).toHaveBeenCalledWith({ data: { status: 'rescheduled' }, where: { id: ID, ownerId: TEST_USER_ID } });
	});

	it.each(['missed', 'interrupted'] as const)('keeps a %s original as it was (history)', async status => {
		const prisma = setupMove(block({ status }));
		await moveBlock(prisma, TEST_USER_ID, ID, range);
		expect(prisma.timeBlock.create).toHaveBeenCalled();
		expect(prisma.timeBlock.updateMany).not.toHaveBeenCalled();
	});

	it.each(['done', 'rescheduled'] as const)('answers 409 for a %s block', async status => {
		const prisma = setupMove(block({ status }));
		expect(await rejection(moveBlock(prisma, TEST_USER_ID, ID, range))).toMatchObject({ code: 'invalid_state', status: 409 });
		expect(prisma.timeBlock.create).not.toHaveBeenCalled();
	});

	it('answers 409 when the block was already moved', async () => {
		const prisma = setupMove(block({ status: 'missed' }));
		vi.mocked(prisma.timeBlock.count).mockResolvedValue(1);
		expect(await rejection(moveBlock(prisma, TEST_USER_ID, ID, range))).toMatchObject({ status: 409 });
	});

	it('rejects moving a block of a task that is now done', async () => {
		const prisma = setupMove(block(), 'done');
		expect(await rejection(moveBlock(prisma, TEST_USER_ID, ID, range))).toMatchObject({ details: [{ code: 'task_closed', field: 'taskId' }], status: 422 });
	});

	it('throws 404 for another owner', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.timeBlock.findFirst).mockResolvedValue(null);
		expect(await rejection(moveBlock(prisma, OTHER_USER_ID, ID, range))).toMatchObject({ status: 404 });
	});
});

describe('deleteBlock', () => {
	it('deletes a planned block scoped by owner', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.timeBlock.findFirst).mockResolvedValue(block());
		await deleteBlock(prisma, TEST_USER_ID, ID);
		expect(prisma.timeBlock.deleteMany).toHaveBeenCalledWith({ where: { id: ID, ownerId: TEST_USER_ID, status: 'planned' } });
	});

	it('keeps history: answers 409 for blocks that are not planned, 404 for another owner', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.timeBlock.findFirst).mockResolvedValue(block({ status: 'done' }));
		expect(await rejection(deleteBlock(prisma, TEST_USER_ID, ID))).toMatchObject({ status: 409 });
		expect(prisma.timeBlock.deleteMany).not.toHaveBeenCalled();

		vi.mocked(prisma.timeBlock.findFirst).mockResolvedValue(null);
		expect(await rejection(deleteBlock(prisma, OTHER_USER_ID, ID))).toMatchObject({ status: 404 });
	});
});
