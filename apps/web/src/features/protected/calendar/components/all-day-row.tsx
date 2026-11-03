import { Calendar, useCalendar } from '~/components/ui/data-display/calendar/calendar';
import { useTranslate } from '~/hooks/use-translate';
import type { CalendarEventItem } from '../api';
import { allDayOn } from '../layout';

interface AllDayRowProps {
	events: CalendarEventItem[];
	onCreate: (day: Date) => void;
	onOpen: (event: CalendarEventItem) => void;
	timeZone: string | undefined;
	tone: (event: CalendarEventItem) => 'default' | 'warning';
}

/** The "All day" strip under the day header: one cell per visible day with the all-day events that cover it. Sticks below the header while the hours scroll. */
export function AllDayRow({ events, onCreate, onOpen, timeZone, tone }: AllDayRowProps) {
	const t = useTranslate();
	const { days } = useCalendar();

	return (
		<div className='sticky top-14 z-20 grid min-h-9 grid-cols-(--calendar-columns) border-b border-border bg-background'>
			<div className='sticky left-0 z-10 flex items-center bg-background px-3 text-xs text-foreground-secondary'>{t('calendar.allDay')}</div>
			{days.map(day => (
				<div className='flex min-w-0 cursor-pointer flex-col gap-1 border-l border-border p-1' key={day.getTime()} onClick={event => event.target === event.currentTarget && onCreate(day)}>
					{allDayOn(events, day, timeZone).map(event => (
						<Calendar.Event key={event.id} onClick={() => onOpen(event)} tone={tone(event)}>
							<Calendar.EventTitle>{event.title}</Calendar.EventTitle>
						</Calendar.Event>
					))}
				</div>
			))}
		</div>
	);
}
