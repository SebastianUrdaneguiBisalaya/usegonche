import { Plus } from 'lucide-react';
import { parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs';
import { type MouseEvent, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/actions-controls/button/button';
import { addDays, Calendar, type CalendarEventMove, type CalendarEventResize, type CalendarView, isSameDay, startOfWeek } from '~/components/ui/data-display/calendar/calendar';
import { Page } from '~/components/ui/layout/page/page';
import { useLanguage } from '~/hooks/use-language';
import { useTranslate } from '~/hooks/use-translate';
import { getApiErrorMessage } from '~/lib/api-error';
import { fromDateOnly, toDateOnly } from '../shared/dates';
import { listStyles } from '../shared/styles';
import { useDateTime } from '../shared/use-datetime';
import { MINUTES_PER_DAY, snap } from '../today/blocks';
import { type CalendarEventItem, useEvents, useUpdateEvent } from './api';
import { AllDayRow } from './components/all-day-row';
import { DeleteEventDialog } from './components/delete-event-dialog';
import { EventModal, type EventModalState } from './components/event-modal';
import { fromWall, timedOn, wallDate } from './layout';

const HOUR_HEIGHT = 56;
const HEADER_HEIGHT = 'h-14';
const VIEWS = ['day', 'week'] as const;

/** Events in the calendar: the neutral tone, and a warning accent for time the user is away. */
const toneOf = (event: CalendarEventItem) => (event.kind === 'out_of_office' ? 'warning' : 'default');

export default function CalendarRoute() {
	const t = useTranslate();
	const { locale } = useLanguage();
	const { timeZone, today: todayOf } = useDateTime();
	const [params, setParams] = useQueryStates({ date: parseAsString.withDefault(''), view: parseAsStringLiteral(VIEWS).withDefault('week') }, { clearOnDefault: true });
	const [modal, setModal] = useState<EventModalState | undefined>(undefined);
	const [deleting, setDeleting] = useState<CalendarEventItem | undefined>(undefined);
	const update = useUpdateEvent();

	const todayValue = todayOf();
	const today = useMemo(() => fromDateOnly(todayValue) ?? new Date(), [todayValue]);
	const date = (params.date && fromDateOnly(params.date)) || today;
	const view: CalendarView = params.view;

	// The wall clock of the user's time zone, so the "now" line sits where the events of today are drawn.
	const [now, setNow] = useState<Date | undefined>(undefined);
	useEffect(() => {
		const tick = () => setNow(wallDate(new Date(), timeZone));
		tick();
		const id = window.setInterval(tick, 60_000);
		return () => window.clearInterval(id);
	}, [timeZone]);

	const first = view === 'day' ? date : startOfWeek(date, 1);
	const last = view === 'day' ? date : addDays(first, 6);
	const events = useEvents(toDateOnly(first), toDateOnly(last));
	const list = events.data ?? [];
	const byId = useMemo(() => new Map(list.map(event => [event.id, event])), [list]);

	const onError = (error: unknown) => toast.error(getApiErrorMessage(error));
	const timeRange = (start: Date, end: Date) => ({ endsAt: fromWall(end, timeZone), startsAt: fromWall(start, timeZone) });
	const onMove = ({ end, id, start }: CalendarEventMove) => {
		if (start && end && byId.has(id)) update.mutate({ allDay: false, id, ...timeRange(start, end) }, { onError });
	};
	const onResize = ({ end, id, start }: CalendarEventResize) => {
		if (byId.has(id)) update.mutate({ allDay: false, id, ...timeRange(start, end) }, { onError });
	};

	const planAt = (event: MouseEvent<HTMLDivElement>, day: Date) => {
		if (event.target !== event.currentTarget) return;
		const offset = event.clientY - event.currentTarget.getBoundingClientRect().top;
		const startMinute = Math.min(Math.max(snap((offset / HOUR_HEIGHT) * 60 - 30), 0), MINUTES_PER_DAY - 60);
		setModal({ date: toDateOnly(day), kind: 'create', startMinute });
	};

	const dayLabel = new Intl.DateTimeFormat(locale, { weekday: 'short' });
	const dayNumber = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });

	return (
		<Page.Root className='min-h-0 flex-1' size='full'>
			<Page.Header>
				<div>
					<Page.Title>{t('calendar.title')}</Page.Title>
					<Page.Description>{t('calendar.subtitle')}</Page.Description>
				</div>
				<Page.Actions className='w-full sm:w-auto'>
					<Button
						className={listStyles.pillTrigger}
						onClick={() => setModal({ date: toDateOnly(isSameDay(date, today) || view === 'day' ? date : today), kind: 'create', startMinute: 9 * 60 })}
						variant='secondary'
					>
						<Button.Icon icon={Plus} />
						<Button.Text>{t('calendar.new')}</Button.Text>
					</Button>
				</Page.Actions>
			</Page.Header>
			<Page.Body className='min-h-0 flex-1 gap-4'>
				<Calendar
					date={date}
					lang={{
						calendar: t('calendar.grid'),
						day: t('calendar.view.day'),
						next: t('calendar.next'),
						previous: t('calendar.previous'),
						today: t('calendar.today'),
						toolbar: t('calendar.toolbar'),
						view: t('calendar.view.label'),
						week: t('calendar.view.week'),
					}}
					locale={locale}
					onDateChange={next => void setParams({ date: toDateOnly(next) === toDateOnly(today) ? null : toDateOnly(next) })}
					onEventMove={onMove}
					onEventResize={onResize}
					onViewChange={next => void setParams({ view: next })}
					today={today}
					view={view}
				>
					<Calendar.Header>
						<Calendar.Toolbar>
							<Calendar.ViewSwitch views={[...VIEWS]} />
							<Calendar.Previous />
							<Calendar.Next />
							<Calendar.Today />
							<Calendar.Description className='px-2 text-base font-medium text-foreground' />
						</Calendar.Toolbar>
					</Calendar.Header>
					<Calendar.Grid aria-busy={events.isPending}>
						<Calendar.DayHeader className={HEADER_HEIGHT}>
							{(day, { isToday }) => (
								<div className='flex w-full flex-col items-center leading-tight'>
									<span className={`text-sm ${isToday ? 'font-semibold text-foreground' : 'text-foreground-secondary'}`}>{dayLabel.format(day)}</span>
									<span className='text-xs text-foreground-secondary'>{dayNumber.format(day)}</span>
								</div>
							)}
						</Calendar.DayHeader>
						<AllDayRow
							events={list}
							onCreate={day => setModal({ allDay: true, date: toDateOnly(day), kind: 'create', startMinute: 9 * 60 })}
							onOpen={event => setModal({ event, kind: 'edit' })}
							timeZone={timeZone}
							tone={toneOf}
						/>
						<Calendar.TimeGrid hourHeight={HOUR_HEIGHT} scrollToHour={8}>
							{days => (
								<>
									{days.map(day => (
										<Calendar.TimeColumn className='cursor-pointer' key={day.getTime()} date={day} onClick={event => planAt(event, day)}>
											{timedOn(list, day, timeZone).map(({ end, event, lane, lanes, movable, start }) => (
												<Calendar.Event
													end={end}
													eventId={event.id}
													key={`${event.id}-${day.getTime()}`}
													lane={lane}
													lanes={lanes}
													movable={movable}
													onClick={() => setModal({ event, kind: 'edit' })}
													resizable={movable}
													start={start}
													tone={toneOf(event)}
												>
													<span className='flex min-w-0 flex-col'>
														<Calendar.EventTitle>{event.title}</Calendar.EventTitle>
														<Calendar.EventTime showEnd />
													</span>
												</Calendar.Event>
											))}
										</Calendar.TimeColumn>
									))}
									<Calendar.NowIndicator now={now} />
								</>
							)}
						</Calendar.TimeGrid>
					</Calendar.Grid>
				</Calendar>
			</Page.Body>
			<EventModal
				onClose={() => setModal(undefined)}
				onDelete={event => {
					setModal(undefined);
					setDeleting(event);
				}}
				state={modal}
			/>
			<DeleteEventDialog event={deleting} onClose={() => setDeleting(undefined)} />
		</Page.Root>
	);
}
