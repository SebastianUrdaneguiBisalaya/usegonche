import { describe, expect, it, vi } from 'vitest';
import { createMockPrisma, TEST_USER_ID } from '../../test/helpers.js';
import { proposeReplan } from './planning.replan.service.js';

const DATE = '2026-11-02'; // Monday
const at = (time: string, day = '02') => new Date(`2026-11-${day}T${time}:00Z`);
const NOW = at('12:00');
const monToTue9to5 = [
	{ endMinute: 1020, startMinute: 540, weekday: 1 },
	{ endMinute: 1020, startMinute: 540, weekday: 2 },
];

// biome-ignore lint/suspicious/noExplicitAny: the mock rows are partial on purpose
const asRow = (value: unknown): any => value;
const pendingBlock = (extra: object = {}) => ({
	actualEnd: null,
	actualStart: null,
	id: 'b1',
	plannedEnd: at('10:00'),
	plannedStart: at('09:00'),
	status: 'missed',
	task: { status: 'todo' },
	taskId: 't1',
	title: null,
	...extra,
});

const setup = (pending: unknown[], { planned = [], events = [], windows = monToTue9to5 }: { events?: unknown[]; planned?: unknown[]; windows?: unknown[] } = {}) => {
	const prisma = createMockPrisma();
	vi.mocked(prisma.timeBlock.findMany).mockResolvedValueOnce(asRow(pending)).mockResolvedValueOnce(asRow(planned));
	vi.mocked(prisma.calendarEvent.findMany).mockResolvedValue(asRow(events));
	vi.mocked(prisma.availabilityWindow.findMany).mockResolvedValue(asRow(windows));
	return prisma;
};

describe('proposeReplan', () => {
	it('returns nothing without missed or interrupted blocks', async () => {
		expect(await proposeReplan(setup([]), TEST_USER_ID, DATE, 7, NOW)).toEqual([]);
	});

	it('only looks at unmoved missed/interrupted blocks of that day, scoped by owner', async () => {
		const prisma = setup([]);
		await proposeReplan(prisma, TEST_USER_ID, DATE, 7, NOW);
		expect(prisma.timeBlock.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { ownerId: TEST_USER_ID, plannedEnd: { gt: at('00:00') }, plannedStart: { lt: at('00:00', '03') }, rescheduledTo: { none: {} }, status: { in: ['missed', 'interrupted'] } },
			})
		);
	});

	it('proposes the first free slot after now that fits the block', async () => {
		const [proposal] = await proposeReplan(setup([pendingBlock()]), TEST_USER_ID, DATE, 7, NOW);
		expect(proposal).toEqual({ blockId: 'b1', durationMinutes: 60, reason: 'missed', suggestedEnd: at('13:00'), suggestedStart: at('12:00'), taskId: 't1', title: null });
	});

	it('skips busy events and already planned blocks', async () => {
		const prisma = setup([pendingBlock()], {
			events: [{ allDay: false, endsAt: at('13:00'), id: 'e1', kind: 'event', startsAt: at('12:00') }],
			planned: [{ plannedEnd: at('14:30'), plannedStart: at('13:00') }],
		});
		const [proposal] = await proposeReplan(prisma, TEST_USER_ID, DATE, 7, NOW);
		expect(proposal?.suggestedStart).toEqual(at('14:30'));
	});

	it('proposes only the remaining time of an interrupted block', async () => {
		const block = pendingBlock({ actualEnd: at('09:20'), actualStart: at('09:00'), status: 'interrupted' });
		const [proposal] = await proposeReplan(setup([block]), TEST_USER_ID, DATE, 7, NOW);
		expect(proposal).toMatchObject({ durationMinutes: 40, reason: 'interrupted' });
		expect((proposal?.suggestedEnd?.getTime() ?? 0) - (proposal?.suggestedStart?.getTime() ?? 0)).toBe(40 * 60_000);
	});

	it('gives each block its own slot (no overlaps between proposals)', async () => {
		const blocks = [pendingBlock(), pendingBlock({ id: 'b2', plannedEnd: at('12:00'), plannedStart: at('10:30') })];
		const [first, second] = await proposeReplan(setup(blocks), TEST_USER_ID, DATE, 7, NOW);
		expect(first?.suggestedEnd).toEqual(at('13:00'));
		expect(second?.suggestedStart).toEqual(at('13:00'));
		expect(second?.durationMinutes).toBe(90);
	});

	it('moves to the next working day when today has no room', async () => {
		const [proposal] = await proposeReplan(setup([pendingBlock()]), TEST_USER_ID, DATE, 7, at('16:30'));
		expect(proposal?.suggestedStart).toEqual(at('09:00', '03'));
	});

	it('answers a null suggestion when nothing fits in the horizon', async () => {
		const [proposal] = await proposeReplan(setup([pendingBlock()], { windows: [] }), TEST_USER_ID, DATE, 7, NOW);
		expect(proposal).toMatchObject({ blockId: 'b1', suggestedEnd: null, suggestedStart: null });
	});

	it('skips blocks of finished tasks and fully used interrupted blocks', async () => {
		const blocks = [
			pendingBlock({ id: 'closed', task: { status: 'done' } }),
			pendingBlock({ actualEnd: at('10:00'), actualStart: at('09:00'), id: 'spent', status: 'interrupted' }),
			pendingBlock({ id: 'open', taskId: null, task: null, title: 'Focus' }),
		];
		const proposals = await proposeReplan(setup(blocks), TEST_USER_ID, DATE, 7, NOW);
		expect(proposals.map(p => p.blockId)).toEqual(['open']);
	});
});
