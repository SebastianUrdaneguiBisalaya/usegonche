import { CalendarDays } from 'lucide-react';
import { parseAsString, useQueryState } from 'nuqs';
import { useMemo } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/actions-controls/button/button';
import { MiniCalendar } from '~/components/ui/data-display/mini-calendar/mini-calendar';
import { Page } from '~/components/ui/layout/page/page';
import { useLanguage } from '~/hooks/use-language';
import { useTranslate } from '~/hooks/use-translate';
import { getApiErrorMessage } from '~/lib/api-error';
import { QuickCapture } from '../inbox/components/quick-capture';
import { fromDateOnly, toDateOnly } from '../shared/dates';
import { listStyles } from '../shared/styles';
import { useUpdateTask } from '../tasks/api';
import { useDay, useSetDayItems } from './api';
import { AgendaCard } from './components/agenda-card';
import { BlockedCard } from './components/blocked-card';
import { InboxCard } from './components/inbox-card';
import { PlanCard } from './components/plan-card';

const STRIP_DAYS = 7;

export default function TodayRoute() {
	const t = useTranslate();
	const { locale } = useLanguage();
	const [param, setParam] = useQueryState('date', parseAsString.withDefault(''));

	const today = useMemo(() => {
		const now = new Date();
		return new Date(now.getFullYear(), now.getMonth(), now.getDate());
	}, []);
	const selected = (param && fromDateOnly(param)) || today;
	const date = toDateOnly(selected);
	const isToday = date === toDateOnly(today);
	const startDate = useMemo(() => new Date(today.getFullYear(), today.getMonth(), today.getDate() - 3), [today]);

	const day = useDay(date);
	const setItems = useSetDayItems(date);
	const update = useUpdateTask();
	const items = day.data?.items ?? [];

	const fail = (error: unknown) => toast.error(getApiErrorMessage(error));
	const save = (taskIds: string[]) => setItems.mutate(taskIds, { onError: fail });
	const taskIds = items.map(item => item.task.id);

	const label = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', weekday: 'short', year: 'numeric' }).format(selected);

	return (
		<Page.Root className='min-h-0 flex-1' size='full'>
			<Page.Header>
				<div>
					<Page.Title>{t('today.title')}</Page.Title>
					<Page.Description>{t('today.subtitle')}</Page.Description>
				</div>
				<Page.Actions className='w-full sm:w-auto'>
					<div className={`${listStyles.pillTrigger} flex items-center gap-2 text-sm`}>
						<CalendarDays aria-hidden className='size-4 text-muted-foreground' />
						<span className='tabular-nums'>{label}</span>
					</div>
					{!isToday && (
						<Button className={listStyles.pillTrigger} onClick={() => void setParam(null)} variant='secondary'>
							<Button.Text>{t('today.backToToday')}</Button.Text>
						</Button>
					)}
				</Page.Actions>
			</Page.Header>
			<Page.Body className='min-h-0 flex-1 gap-4'>
				<MiniCalendar
					className='max-w-full self-start overflow-x-auto'
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
				<QuickCapture />
				<div className='grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,18rem)]'>
					<AgendaCard blocks={day.data?.blocks ?? []} date={date} isToday={isToday} />
					<PlanCard
						error={day.isError}
						isLoading={day.isPending}
						isToday={isToday}
						items={items}
						onAdd={id => save([...taskIds, id])}
						onRemove={id => save(taskIds.filter(current => current !== id))}
						onRetry={() => void day.refetch()}
						onToggleDone={(id, done) => update.mutate({ changes: { status: done ? 'done' : 'todo' }, id }, { onError: fail, onSettled: () => void day.refetch() })}
						pending={setItems.isPending || update.isPending}
					/>
				</div>
			</Page.Body>
		</Page.Root>
	);
}
