import { ArrowRightLeft, Ban, CalendarClock, CircleCheck, CirclePlay, Flag, FolderKanban, type LucideIcon, RotateCcw, Zap } from 'lucide-react';
import { Button } from '~/components/ui/actions-controls/button/button';
import { Skeleton } from '~/components/ui/foundations/skeleton/skeleton';
import { Typography } from '~/components/ui/foundations/typography/typography';
import { useLanguage } from '~/hooks/use-language';
import { useTranslate } from '~/hooks/use-translate';
import type { TranslationKey } from '~/i18n';
import { formatRelative } from '../../shared/relative-time';
import { listStyles } from '../../shared/styles';
import { type ActivityEvent, useRecentActivity } from '../api';

interface Reading {
	icon: LucideIcon;
	iconClassName?: string;
	label: TranslationKey;
}

/** What an event says in a word ("Completed", "Moved"...), with its icon. A status change reads by where the task ended up. */
function readEvent(event: ActivityEvent): Reading {
	if (event.type === 'status_changed') {
		if (event.toStatus === 'done') return { icon: CircleCheck, iconClassName: 'text-success', label: 'today.activity.completed' };
		if (event.toStatus === 'cancelled') return { icon: Ban, label: 'today.activity.cancelled' };
		if (event.toStatus === 'in_progress') return { icon: CirclePlay, label: 'today.activity.started' };
		return { icon: RotateCcw, label: 'today.activity.reopened' };
	}
	if (event.type === 'priority_changed') return { icon: Flag, label: 'today.activity.priority' };
	if (event.type === 'due_changed') return { icon: CalendarClock, label: 'today.activity.due' };
	if (event.type === 'project_changed') return { icon: FolderKanban, label: 'today.activity.project' };
	return { icon: ArrowRightLeft, label: 'today.activity.moved' };
}

/** The latest things that happened to the user's tasks (completed, moved, re-prioritized...), newest first, with how long ago. */
export function RecentActivityCard() {
	const t = useTranslate();
	const { locale } = useLanguage();
	const activity = useRecentActivity();
	const events = activity.data ?? [];

	return (
		<section className={`${listStyles.card} flex flex-col gap-4 p-5`}>
			<Typography.H3 className='flex items-center gap-3 text-base font-semibold'>
				<Zap aria-hidden className='size-5 text-muted-foreground' />
				{t('today.activity.title')}
			</Typography.H3>
			{activity.isError ? (
				<div className='flex flex-col items-start gap-2'>
					<Typography.Span className='text-sm text-muted-foreground'>{t('today.activity.error')}</Typography.Span>
					<Button onClick={() => void activity.refetch()} variant='secondary'>
						<Button.Text>{t('today.activity.retry')}</Button.Text>
					</Button>
				</div>
			) : activity.isPending ? (
				<Skeleton className='gap-3'>
					{[0, 1, 2].map(key => (
						<Skeleton.Item className='h-5 w-full rounded-md' key={key} />
					))}
				</Skeleton>
			) : events.length === 0 ? (
				<Typography.Span className='text-sm text-muted-foreground'>{t('today.activity.empty')}</Typography.Span>
			) : (
				<ul className='flex flex-col gap-3'>
					{events.map(event => {
						const { icon: Icon, iconClassName = 'text-muted-foreground', label } = readEvent(event);
						return (
							<li className='flex items-center gap-3 text-sm' key={event.id}>
								<Icon aria-hidden className={`size-5 shrink-0 ${iconClassName}`} strokeWidth={1.5} />
								<span className='flex min-w-0 flex-1 items-baseline gap-2'>
									<span className='shrink-0 font-medium'>{t(label)}</span>
									<span className='truncate text-muted-foreground' title={event.taskTitle}>
										{event.taskTitle}
									</span>
								</span>
								<time className='shrink-0 text-xs text-muted-foreground' dateTime={event.occurredAt}>
									{formatRelative(event.occurredAt, locale)}
								</time>
							</li>
						);
					})}
				</ul>
			)}
		</section>
	);
}
