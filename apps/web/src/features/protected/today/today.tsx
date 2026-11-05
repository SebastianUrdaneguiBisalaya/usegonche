import { CalendarDays } from 'lucide-react';
import { parseAsString, useQueryState } from 'nuqs';
import { Fragment, useMemo } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/actions-controls/button/button';
import { MiniCalendar } from '~/components/ui/data-display/mini-calendar/mini-calendar';
import { Layout } from '~/components/ui/layout/layout/layout';
import { Page } from '~/components/ui/layout/page/page';
import { cn } from '~/components/ui/utils/tailwind/cn';
import { useLanguage } from '~/hooks/use-language';
import { useTranslate } from '~/hooks/use-translate';
import { getApiErrorMessage } from '~/lib/api-error';
import { QuickCapture } from '../inbox/components/quick-capture';
import { useMaterializeRecurrences } from '../recurrences/api';
import { fromDateOnly, toDateOnly } from '../shared/dates';
import { listStyles } from '../shared/styles';
import { useDateTime } from '../shared/use-datetime';
import { useUpdateTask } from '../tasks/api';
import { useDay, useSetDayItems } from './api';
import { AgendaCard } from './components/agenda-card';
import { BlockedCard } from './components/blocked-card';
import { CapacityCard } from './components/capacity-card';
import { EventsCard } from './components/events-card';
import { FocusCard } from './components/focus-card';
import { InboxCard } from './components/inbox-card';
import { PlanCard } from './components/plan-card';
import { RecentActivityCard } from './components/recent-activity-card';
import { ReplanCard } from './components/replan-card';

const STRIP_DAYS = 7;

export default function TodayRoute() {
	const t = useTranslate();
	const { locale } = useLanguage();
	const [param, setParam] = useQueryState('date', parseAsString.withDefault(''));

	const { today: todayOf } = useDateTime();
	const todayValue = todayOf();
	const today = useMemo(() => fromDateOnly(todayValue) ?? new Date(), [todayValue]);
	const selected = (param && fromDateOnly(param)) || today;
	const date = toDateOnly(selected);
	const isToday = date === toDateOnly(today);
	const startDate = useMemo(() => new Date(today.getFullYear(), today.getMonth(), today.getDate() - 3), [today]);

	// Opening Today fills in the occurrences of the recurrence rules (once a day, idempotent).
	useMaterializeRecurrences(toDateOnly(today));
	const day = useDay(date);
	const setItems = useSetDayItems(date);
	const update = useUpdateTask();
	const items = day.data?.items ?? [];

	const fail = (error: unknown) => toast.error(getApiErrorMessage(error));
	const save = (taskIds: string[]) => setItems.mutate(taskIds, { onError: fail, onSuccess: () => toast.success(t('today.toast.planUpdated')) });
	const taskIds = items.map(item => item.task.id);

	const label = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', weekday: 'short', year: 'numeric' }).format(selected);

	return (
		<Fragment>
			<Page.Header>
				<div>
					<Page.Title>{t('today.title')}</Page.Title>
					<Page.Description>{t('today.subtitle')}</Page.Description>
				</div>
				<Page.Actions className='w-full sm:w-auto'>
					{!isToday && (
						<Button className={listStyles.pillTrigger} onClick={() => void setParam(null)} variant='secondary'>
							<Button.Text>{t('today.backToToday')}</Button.Text>
						</Button>
					)}
					<div className={cn(listStyles.pillTrigger, 'flex items-center gap-2 text-sm')}>
						<CalendarDays aria-hidden className='size-4 text-muted-foreground' />
						<span className='tabular-nums'>{label}</span>
					</div>
					<QuickCapture />
				</Page.Actions>
			</Page.Header>
			<Page.Body className='min-h-0 flex-1 gap-4'>
				<Layout.Grid className='lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)]' cols={1} gap='md'>
					<div className='flex flex-col gap-4'>
						<MiniCalendar
							className='shrink-0'
							days={STRIP_DAYS}
							defaultStartDate={startDate}
							lang={{ nextDays: t('today.strip.next'), previousDays: t('today.strip.previous') }}
							locale={locale}
							onValueChange={next => next && void setParam(toDateOnly(next) === toDateOnly(today) ? null : toDateOnly(next))}
							value={selected}
						>
							<MiniCalendar.Navigation direction='prev' />
							<MiniCalendar.Days>{d => <MiniCalendar.Day date={d} key={d.toISOString()} />}</MiniCalendar.Days>
							<MiniCalendar.Navigation direction='next' />
						</MiniCalendar>
						<AgendaCard blocks={day.data?.blocks ?? []} date={date} isToday={isToday} />
					</div>
					<div className='flex flex-col gap-4'>
						<ReplanCard date={date} />
						{day.data && <CapacityCard capacity={day.data.capacity} />}
						<PlanCard
							className='min-h-0 flex-1'
							error={day.isError}
							isLoading={day.isPending}
							isToday={isToday}
							items={items}
							onAdd={id => save([...taskIds, id])}
							onRemove={id => save(taskIds.filter(current => current !== id))}
							onRetry={() => void day.refetch()}
							onToggleDone={(id, done) =>
								update.mutate(
									{ changes: { status: done ? 'done' : 'todo' }, id },
									{ onError: fail, onSettled: () => void day.refetch(), onSuccess: () => toast.success(done ? t('tasks.toast.completed') : t('tasks.toast.statusChanged')) }
								)
							}
							pending={setItems.isPending || update.isPending}
						/>
					</div>
					<div className='flex flex-col gap-4'>
						<BlockedCard />
						<RecentActivityCard className='min-h-0 flex-1 basis-0 overflow-y-auto' />
						<InboxCard className='min-h-0 flex-1 basis-0 overflow-y-auto' />
					</div>
				</Layout.Grid>
			</Page.Body>
		</Fragment>
	);
}
