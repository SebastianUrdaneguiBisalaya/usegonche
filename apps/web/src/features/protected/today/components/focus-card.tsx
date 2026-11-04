import { Pause, Play, Square, Zap } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/actions-controls/button/button';
import { Countdown } from '~/components/ui/data-display/countdown/countdown';
import { Combobox } from '~/components/ui/forms-inputs/combobox/combobox';
import { Select } from '~/components/ui/forms-inputs/select/select';
import { Typography } from '~/components/ui/foundations/typography/typography';
import { cn } from '~/components/ui/utils/tailwind/cn';
import { useTranslate } from '~/hooks/use-translate';
import { getApiErrorMessage } from '~/lib/api-error';
import { listStyles } from '../../shared/styles';
import { useOpenTasks, useRecordFocus } from '../api';
import { FOCUS_PRESETS, MIN_RECORDED_MS, remainingMs, useFocusSession, workedMs } from '../focus-session';

/**
 * A focus timer (25:00 by default) with an optional task. Finishing it records a time block as `done`, stopping it early as `interrupted`, both with
 * the time really worked (pauses are not counted). Nothing is stored until then: the timer is plain frontend state.
 */
export function FocusCard() {
	const t = useTranslate();
	const session = useFocusSession();
	const record = useRecordFocus();
	const open = useOpenTasks();
	const [query, setQuery] = useState('');
	const settled = useRef(false);

	const { phase, plannedMinutes, taskId } = session;
	const active = phase !== 'idle';
	const running = phase === 'running';
	// Once a second while running, so the ring follows the countdown.
	const [, setTick] = useState(0);
	useEffect(() => {
		if (!running) return;
		const id = window.setInterval(() => setTick(value => value + 1), 1000);
		return () => window.clearInterval(id);
	}, [running]);
	const now = Date.now();
	const plannedMs = plannedMinutes * 60_000;
	const left = remainingMs(session, now);
	// The moment a running timer ends: it does not move while the timer runs, so the countdown keeps its own clock.
	const target = new Date((session.segmentStart ?? now) + plannedMs - session.workedBeforeMs);

	const finish = (status: 'done' | 'interrupted') => {
		const state = useFocusSession.getState();
		if (state.phase === 'idle' || state.startedAt === null || settled.current) return;
		settled.current = true;
		const finishedAt = Date.now();
		const worked = status === 'done' ? state.plannedMinutes * 60_000 : workedMs(state, finishedAt);
		const { startedAt, taskId: chosen } = state;
		state.reset();
		if (worked < MIN_RECORDED_MS) {
			settled.current = false;
			toast.info(t('today.focus.tooShort'));
			return;
		}
		record.mutate(
			{
				actualEnd: new Date(startedAt + worked).toISOString(),
				actualStart: new Date(startedAt).toISOString(),
				plannedEnd: new Date(startedAt + state.plannedMinutes * 60_000).toISOString(),
				plannedStart: new Date(startedAt).toISOString(),
				status,
				...(chosen ? { taskId: chosen } : { title: t('today.focus.session') }),
			},
			{
				onError: error => toast.error(getApiErrorMessage(error)),
				onSettled: () => {
					settled.current = false;
				},
				onSuccess: () => toast.success(t(status === 'done' ? 'today.focus.saved' : 'today.focus.savedStopped')),
			}
		);
	};

	// The timer may have run out while this card was not on screen (another page, a closed laptop): record it as soon as it is back.
	// biome-ignore lint/correctness/useExhaustiveDependencies: only on mount.
	useEffect(() => {
		const state = useFocusSession.getState();
		if (state.phase === 'running' && remainingMs(state, Date.now()) === 0) finish('done');
	}, []);

	const needle = query.trim().toLowerCase();
	const options = (open.data ?? []).filter(task => task.title.toLowerCase().includes(needle)).slice(0, 8);
	const chosen = (open.data ?? []).find(task => task.id === taskId);
	const minutes = Math.floor(left / 60_000);
	const seconds = Math.floor((left % 60_000) / 1000);

	return (
		<section className={cn(listStyles.card, 'flex flex-col gap-4 p-5')}>
			<div className='flex items-center justify-between gap-3'>
				<Typography.H3 className='flex items-center gap-3 text-base font-semibold'>
					<Zap aria-hidden className='size-5 text-muted-foreground' />
					{t('today.focus.title')}
				</Typography.H3>
				{!active && (
					<Select.Root onChange={next => session.setPlannedMinutes(Number(next))} value={String(plannedMinutes)}>
						<Select.Trigger aria-label={t('today.focus.duration')} className={cn(listStyles.pillTrigger, 'py-1 text-xs')}>
							<Select.Value />
						</Select.Trigger>
						<Select.Content>
							<Select.ItemList>
								{FOCUS_PRESETS.map(preset => (
									<Select.Item key={preset} value={String(preset)}>
										{t('today.block.minutes', { count: preset })}
									</Select.Item>
								))}
							</Select.ItemList>
						</Select.Content>
					</Select.Root>
				)}
			</div>
			<div className='flex items-center gap-5'>
				<FocusRing progress={plannedMs > 0 ? workedMs(session, now) / plannedMs : 0} />
				<div className='flex min-w-0 flex-1 flex-col gap-1'>
					{running ? (
						// The component keeps its own clock while the timer runs; it is not mounted while paused or idle, which show the time it holds.
						<Countdown.Root className='items-start gap-0' onComplete={() => finish('done')} size='sm' target={target} units={['minutes', 'seconds']}>
							<div className='flex items-center gap-1'>
								<Countdown.Unit className='gap-0' label='' unit='minutes' />
								<Countdown.Separator />
								<Countdown.Unit className='gap-0' label='' unit='seconds' />
							</div>
						</Countdown.Root>
					) : (
						<span className='font-secondary text-3xl font-medium leading-none tabular-nums' role='timer'>
							{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
						</span>
					)}
					<Typography.Span className='truncate text-sm text-muted-foreground'>{chosen?.title ?? t('today.focus.session')}</Typography.Span>
				</div>
				<div className='flex shrink-0 items-center gap-2'>
					{active && (
						<Button aria-label={t('today.focus.stop')} className='size-10 rounded-full p-0' disabled={record.isPending} onClick={() => finish('interrupted')} size='icon' variant='ghost'>
							<Button.Icon icon={Square} />
						</Button>
					)}
					<Button
						aria-label={t(phase === 'idle' ? 'today.focus.start' : running ? 'today.focus.pause' : 'today.focus.resume')}
						className='size-12 rounded-full border border-border bg-foreground/6 p-0'
						onClick={() => (phase === 'idle' ? session.start() : running ? session.pause() : session.resume())}
						size='icon'
						variant='ghost'
					>
						<Button.Icon icon={running ? Pause : Play} />
					</Button>
				</div>
			</div>
			{!active && (
				<Combobox filter={false} onInputChange={setQuery} onValueChange={next => session.setTaskId(next ?? null)} value={taskId}>
					<Combobox.Input containerClassName={listStyles.pillInput} placeholder={t('today.focus.task')} />
					<Combobox.Content emptyMessage={t('today.plan.addEmpty')}>
						{options.map(task => (
							<Combobox.Item key={task.id} label={task.title} value={task.id}>
								{task.title}
							</Combobox.Item>
						))}
					</Combobox.Content>
				</Combobox>
			)}
		</section>
	);
}

const RING_SIZE = 84;
const RING_STROKE = 4;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/** The ring around the session: empty before it starts, filling as time is worked. */
function FocusRing({ progress }: { progress: number }) {
	const filled = Math.min(Math.max(progress, 0), 1);
	return (
		<svg aria-hidden className='shrink-0 -rotate-90' height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} width={RING_SIZE}>
			<circle className='stroke-foreground/10' cx={RING_SIZE / 2} cy={RING_SIZE / 2} fill='none' r={RING_RADIUS} strokeWidth={RING_STROKE} />
			<circle
				className='stroke-foreground transition-[stroke-dashoffset] duration-1000 ease-linear'
				cx={RING_SIZE / 2}
				cy={RING_SIZE / 2}
				fill='none'
				r={RING_RADIUS}
				strokeDasharray={RING_LENGTH}
				strokeDashoffset={RING_LENGTH * (1 - filled)}
				strokeLinecap='round'
				strokeWidth={RING_STROKE}
			/>
		</svg>
	);
}
