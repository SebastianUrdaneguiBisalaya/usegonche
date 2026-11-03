import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '~/components/ui/actions-controls/button/button';
import { Typography } from '~/components/ui/foundations/typography/typography';
import { useTranslate } from '~/hooks/use-translate';
import type { CalendarEventItem } from '../../calendar/api';
import { DeleteEventDialog } from '../../calendar/components/delete-event-dialog';
import { EventModal, type EventModalState } from '../../calendar/components/event-modal';
import { listStyles } from '../../shared/styles';
import { useDateTime } from '../../shared/use-datetime';

interface EventsCardProps {
	date: string;
	events: CalendarEventItem[];
}

/** The calendar events of the selected day (they already count against its capacity): click one to edit it, or add a new one. */
export function EventsCard({ date, events }: EventsCardProps) {
	const t = useTranslate();
	const { formatTime } = useDateTime();
	const [modal, setModal] = useState<EventModalState | undefined>(undefined);
	const [deleting, setDeleting] = useState<CalendarEventItem | undefined>(undefined);
	const sorted = useMemo(() => [...events].sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.startsAt.localeCompare(b.startsAt)), [events]);

	return (
		<section className={`${listStyles.card} flex flex-col gap-3 p-5`}>
			<div className='flex items-center justify-between gap-3'>
				<Typography.H3 className='text-base font-semibold'>{t('today.events.title')}</Typography.H3>
				<Button className={listStyles.pillTrigger} onClick={() => setModal({ date, kind: 'create', startMinute: 9 * 60 })} variant='secondary'>
					<Button.Icon icon={Plus} />
					<Button.Text>{t('today.events.new')}</Button.Text>
				</Button>
			</div>
			{sorted.length === 0 ? (
				<Typography.Span className='text-sm text-muted-foreground'>{t('today.events.empty')}</Typography.Span>
			) : (
				<ul className='flex flex-col gap-1.5'>
					{sorted.map(event => (
						<li key={event.id}>
							<button
								className='flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-border px-3 py-2 text-left hover:bg-foreground/[0.04]'
								onClick={() => setModal({ event, kind: 'edit' })}
								type='button'
							>
								<span className='flex min-w-0 flex-col'>
									<span className='truncate text-sm font-medium'>{event.title}</span>
									{event.kind === 'out_of_office' && <span className='text-xs text-warning'>{t('calendar.kind.out_of_office')}</span>}
								</span>
								<span className='shrink-0 text-xs text-muted-foreground tabular-nums'>
									{event.allDay ? t('calendar.allDay') : `${formatTime(event.startsAt)} – ${formatTime(event.endsAt)}`}
								</span>
							</button>
						</li>
					))}
				</ul>
			)}
			<EventModal
				onClose={() => setModal(undefined)}
				onDelete={event => {
					setModal(undefined);
					setDeleting(event);
				}}
				state={modal}
			/>
			<DeleteEventDialog event={deleting} onClose={() => setDeleting(undefined)} />
		</section>
	);
}
