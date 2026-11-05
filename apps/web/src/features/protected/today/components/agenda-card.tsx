import { Plus, TriangleAlert } from 'lucide-react';
import { type PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/actions-controls/button/button';
import { Typography } from '~/components/ui/foundations/typography/typography';
import { cn } from '~/components/ui/utils/tailwind/cn';
import { useLanguage } from '~/hooks/use-language';
import { useTranslate } from '~/hooks/use-translate';
import { minuteInZone } from '~/lib/datetime';
import { listStyles } from '../../shared/styles';
import { useTasksByIds } from '../../shared/task-lookup';
import { useDateTime } from '../../shared/use-datetime';
import { type DayBlock, useMoveBlock } from '../api';
import { atMinute, MINUTES_PER_DAY, minuteOf, SNAP_MINUTES, snap } from '../blocks';
import { BlockModal, type BlockModalState } from './block-modal';

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const HOUR_PX = 56;
const MIN_BLOCK_PX = 20;
const DRAG_THRESHOLD_PX = 4;
const px = (minute: number) => (minute / 60) * HOUR_PX;

const tone: Record<string, string> = {
	done: 'border-success/40 bg-success/10',
	interrupted: 'border-warning/40 bg-warning/10',
	missed: 'border-destructive/40 bg-destructive/10',
	planned: 'border-border-strong bg-foreground/[0.06]',
};

interface AgendaCardProps {
	blocks: DayBlock[];
	date: string;
	isToday: boolean;
}

/** The day as a vertical hour grid of time blocks: click an empty slot to plan one, click a block to edit it, drag a planned block to move it. */
export function AgendaCard({ blocks, date, isToday }: AgendaCardProps) {
	const t = useTranslate();
	const { locale } = useLanguage();
	const { timeZone, toApi } = useDateTime();
	const move = useMoveBlock();
	const [modal, setModal] = useState<BlockModalState | undefined>(undefined);
	const [drag, setDrag] = useState<{ id: string; minute: number } | undefined>(undefined);
	const scroller = useRef<HTMLDivElement>(null);

	// A rescheduled block is history: only its replacement is drawn.
	const visible = useMemo(() => blocks.filter(block => block.status !== 'rescheduled'), [blocks]);
	const tasks = useTasksByIds([...new Set(visible.flatMap(block => (block.taskId ? [block.taskId] : [])))]);
	const taskTitles = useMemo(() => new Map((tasks.data ?? []).map(task => [task.id, task.title])), [tasks.data]);
	const titleOf = (block: DayBlock) => block.title ?? (block.taskId ? taskTitles.get(block.taskId) : undefined) ?? t('today.agenda.untitled');

	const hourLabel = useMemo(() => new Intl.DateTimeFormat(locale, { hour: 'numeric', timeZone }), [locale, timeZone]);
	const timeLabel = useMemo(() => new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone }), [locale, timeZone]);
	const [now, setNow] = useState(() => new Date());
	useEffect(() => {
		const id = window.setInterval(() => setNow(new Date()), 60_000);
		return () => window.clearInterval(id);
	}, []);
	const nowMinute = minuteInZone(now, timeZone);

	// biome-ignore lint/correctness/useExhaustiveDependencies: scroll to the morning once per day.
	useEffect(() => {
		if (scroller.current) scroller.current.scrollTop = px(Math.max((isToday ? nowMinute : 8 * 60) - 60, 0));
	}, [date]);

	const startDrag = (event: ReactPointerEvent<HTMLButtonElement>, block: DayBlock, startMinute: number, endMinute: number) => {
		if (block.status !== 'planned') return;
		const originY = event.clientY;
		let moved = false;
		let minute = startMinute;
		const onMove = (e: PointerEvent) => {
			if (!moved && Math.abs(e.clientY - originY) < DRAG_THRESHOLD_PX) return;
			moved = true;
			minute = Math.min(Math.max(snap(startMinute + ((e.clientY - originY) / HOUR_PX) * 60), 0), MINUTES_PER_DAY - (endMinute - startMinute));
			setDrag({ id: block.id, minute });
		};
		const onUp = () => {
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerup', onUp);
			setDrag(undefined);
			if (!moved) return setModal({ block, date, kind: 'edit', title: titleOf(block) });
			if (minute === startMinute) return;
			const length = endMinute - startMinute;
			move.mutate({ id: block.id, plannedEnd: toApi(date, minute + length), plannedStart: toApi(date, minute) }, { onSuccess: () => toast.success(t('today.toast.blockUpdated')) });
		};
		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp);
	};

	return (
		<section className={cn(listStyles.card, 'flex flex-col gap-3 p-5')}>
			<div className='flex items-center justify-between gap-3'>
				<Typography.H3 className='text-lg font-semibold'>{t('today.agenda.title')}</Typography.H3>
				<Button className={listStyles.pillTrigger} onClick={() => setModal({ date, kind: 'create', startMinute: isToday ? Math.ceil(nowMinute / 15) * 15 : 9 * 60 })} variant='secondary'>
					<Button.Icon icon={Plus} />
					<Button.Text>{t('today.agenda.new')}</Button.Text>
				</Button>
			</div>
			<div className='max-h-[32rem] overflow-y-auto' ref={scroller}>
				<div className='relative ml-14' style={{ height: px(MINUTES_PER_DAY) }}>
					{HOURS.map(hour => (
						<button
							aria-label={t('today.agenda.planAt', { time: hourLabel.format(atMinute(date, hour * 60, timeZone)) })}
							className='absolute inset-x-0 cursor-pointer border-t border-border/60 hover:bg-foreground/[0.03]'
							key={hour}
							onClick={() => setModal({ date, kind: 'create', startMinute: hour * 60 })}
							style={{ height: HOUR_PX, top: px(hour * 60) }}
							type='button'
						>
							<span className='absolute -left-14 -top-2 w-12 text-right text-xs text-muted-foreground'>{hourLabel.format(atMinute(date, hour * 60, timeZone))}</span>
						</button>
					))}
					{isToday && (
						<div aria-hidden className='pointer-events-none absolute inset-x-0 z-10 border-t-2 border-foreground' style={{ top: px(nowMinute) }}>
							<span className='absolute -left-1 -top-1.5 size-2.5 rounded-full bg-foreground' />
						</div>
					)}
					{visible.map(block => {
						const startMinute = minuteOf(date, block.plannedStart, timeZone);
						const endMinute = Math.max(minuteOf(date, block.plannedEnd, timeZone), startMinute + SNAP_MINUTES);
						const top = drag?.id === block.id ? drag.minute : startMinute;
						const shownStart = atMinute(date, top, timeZone);
						return (
							<button
								className={cn(
									'absolute inset-x-1 z-20 flex flex-col gap-0.5 overflow-hidden rounded-xl border px-3 py-1.5 text-left',
									tone[block.status] ?? tone.planned,
									block.status === 'planned' ? 'cursor-grab touch-none active:cursor-grabbing' : 'cursor-pointer',
									drag?.id === block.id ? 'shadow-lg' : ''
								)}
								key={block.id}
								onClick={event => event.detail === 0 && setModal({ block, date, kind: 'edit', title: titleOf(block) })}
								onPointerDown={event => startDrag(event, block, startMinute, endMinute)}
								style={{ height: Math.max(px(endMinute - startMinute), MIN_BLOCK_PX), top: px(top) }}
								type='button'
							>
								<span className='flex items-center gap-1.5 truncate text-sm font-medium'>
									{block.warnings.length > 0 && <TriangleAlert aria-label={t('today.agenda.conflict')} className='size-3.5 shrink-0 text-warning' />}
									<span className={cn('truncate', block.status === 'missed' ? 'line-through' : '')}>{titleOf(block)}</span>
								</span>
								{endMinute - startMinute >= 30 && (
									<span className='truncate text-xs text-muted-foreground tabular-nums'>
										{timeLabel.format(shownStart)} – {timeLabel.format(atMinute(date, top + (endMinute - startMinute), timeZone))}
									</span>
								)}
							</button>
						);
					})}
				</div>
			</div>
			{visible.length === 0 && <Typography.Span className='text-center text-sm text-muted-foreground'>{t('today.agenda.empty')}</Typography.Span>}
			<BlockModal onClose={() => setModal(undefined)} state={modal} />
		</section>
	);
}
