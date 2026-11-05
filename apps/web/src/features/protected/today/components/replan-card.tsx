import { CalendarCheck, CalendarClock } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/actions-controls/button/button';
import { Pill } from '~/components/ui/data-display/pill/pill';
import { Skeleton } from '~/components/ui/foundations/skeleton/skeleton';
import { Typography } from '~/components/ui/foundations/typography/typography';
import { ApplicationState } from '~/components/ui/overlays-feedback/application-state/application-state';
import { cn } from '~/components/ui/utils/tailwind/cn';
import { useLanguage } from '~/hooks/use-language';
import { useTranslate } from '~/hooks/use-translate';
import { listStyles } from '../../shared/styles';
import { useTasksByIds } from '../../shared/task-lookup';
import { useDateTime } from '../../shared/use-datetime';
import { useMoveBlock, useReplanProposals } from '../api';
import { formatMinutes } from '../format';

/**
 * When the day has missed or interrupted blocks, proposes a new slot for each one. Nothing happens until the user accepts: accepting plans a new
 * block (`POST /planning/blocks/:id/move`) and keeps the old one and the task history as they were. Rejecting just hides the proposal here.
 * Always shown (skeleton while loading, an empty state when there is nothing to replan) so the cards below never move.
 */
export function ReplanCard({ date }: { date: string }) {
	const t = useTranslate();
	const { locale } = useLanguage();
	const { timeZone } = useDateTime();
	const proposals = useReplanProposals(date);
	const move = useMoveBlock();
	const [rejected, setRejected] = useState<ReadonlySet<string>>(new Set());

	const pending = useMemo(() => (proposals.data ?? []).filter(proposal => !rejected.has(proposal.blockId)), [proposals.data, rejected]);
	const tasks = useTasksByIds([...new Set(pending.flatMap(proposal => (proposal.taskId ? [proposal.taskId] : [])))]);
	const titles = useMemo(() => new Map((tasks.data ?? []).map(task => [task.id, task.title])), [tasks.data]);
	const slot = useMemo(() => new Intl.DateTimeFormat(locale, { day: 'numeric', hour: 'numeric', minute: '2-digit', month: 'short', timeZone, weekday: 'short' }), [locale, timeZone]);

	return (
		<section className={cn(listStyles.card, 'flex flex-col gap-3 p-5')}>
			<div className='flex flex-col gap-1'>
				<span className='flex items-center gap-2 text-base font-semibold'>
					<CalendarClock aria-hidden className='size-5 text-muted-foreground' />
					{t('today.replan.title')}
				</span>
				<Typography.Span className='text-xs text-muted-foreground'>{t('today.replan.subtitle')}</Typography.Span>
			</div>
			{proposals.isPending ? (
				<Skeleton className='h-16 w-full rounded-xl' />
			) : pending.length === 0 ? (
				<ApplicationState.EmptyState className='py-2' description={null} icon={CalendarCheck} title={t('today.replan.empty')} />
			) : (
				<ul className='flex flex-col gap-2'>
					{pending.map(proposal => {
						const title = proposal.title ?? (proposal.taskId ? titles.get(proposal.taskId) : undefined) ?? t('today.agenda.untitled');
						return (
							<li className='flex flex-col gap-2 rounded-xl border border-border px-3 py-2' key={proposal.blockId}>
								<div className='flex items-center justify-between gap-2'>
									<Typography.Span className='truncate text-sm font-medium' title={title}>
										{title}
									</Typography.Span>
									<Pill variant='outline'>
										<Pill.Text>{t(`today.replan.reason.${proposal.reason}`)}</Pill.Text>
									</Pill>
								</div>
								<Typography.Span className='text-xs text-muted-foreground'>
									{proposal.suggestedStart
										? t('today.replan.suggestion', { duration: formatMinutes(proposal.durationMinutes), time: slot.format(new Date(proposal.suggestedStart)) })
										: t('today.replan.noSlot', { duration: formatMinutes(proposal.durationMinutes) })}
								</Typography.Span>
								<div className='flex justify-end gap-2'>
									<Button onClick={() => setRejected(current => new Set(current).add(proposal.blockId))} variant='ghost'>
										<Button.Text>{t('today.replan.reject')}</Button.Text>
									</Button>
									<Button
										disabled={!proposal.suggestedStart || !proposal.suggestedEnd || move.isPending}
										onClick={() =>
											proposal.suggestedStart &&
											proposal.suggestedEnd &&
											move.mutate(
												{ id: proposal.blockId, plannedEnd: new Date(proposal.suggestedEnd).toISOString(), plannedStart: new Date(proposal.suggestedStart).toISOString() },
												{ onSuccess: () => toast.success(t('today.replan.accepted')) }
											)
										}
										variant='secondary'
									>
										<Button.Text>{t('today.replan.accept')}</Button.Text>
									</Button>
								</div>
							</li>
						);
					})}
				</ul>
			)}
		</section>
	);
}
