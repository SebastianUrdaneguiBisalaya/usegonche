import { Bell, Check } from 'lucide-react';
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryState, useQueryStates } from 'nuqs';
import { Fragment, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/actions-controls/button/button';
import { Pagination } from '~/components/ui/data-display/pagination/pagination';
import { Skeleton } from '~/components/ui/foundations/skeleton/skeleton';
import { Typography } from '~/components/ui/foundations/typography/typography';
import { Page } from '~/components/ui/layout/page/page';
import { ApplicationState } from '~/components/ui/overlays-feedback/application-state/application-state';
import { cn } from '~/components/ui/utils/tailwind/cn';
import { useTranslate } from '~/hooks/use-translate';
import { getApiErrorMessage } from '~/lib/api-error';
import { ListSearch } from '../shared/list-search';
import { PAGE_SIZE } from '../shared/paged';
import { StatusTabs } from '../shared/status-tabs';
import { listStyles } from '../shared/styles';
import { targetId, useDeleteReminder, useDismiss, useReminder, useReminders, useSentReminders, useTargets } from './api';
import { ReminderDetail } from './components/reminder-detail';
import { ReminderRow } from './components/reminder-row';

const tabs = ['all', 'upcoming', 'snoozed', 'dismissed'] as const;

export default function RemindersRoute() {
	const t = useTranslate();
	const [{ page, q, tab }, setParams] = useQueryStates(
		{ page: parseAsInteger.withDefault(1), q: parseAsString.withDefault(''), tab: parseAsStringLiteral(tabs).withDefault('all') },
		{ clearOnDefault: true }
	);
	const [openId, setOpenId] = useQueryState('reminder', parseAsString.withDefault(''));
	const [checked, setChecked] = useState<ReadonlySet<string>>(new Set());

	const list = useReminders({ page, q, tab });
	const sentList = useSentReminders();
	const dismiss = useDismiss();
	const remove = useDeleteReminder();
	const reminders = list.data?.data ?? [];
	const meta = list.data?.meta;
	const fail = (error: unknown) => toast.error(getApiErrorMessage(error));

	// Deleting or dismissing the last row of the last page leaves it empty: go back to the last one that has rows.
	useEffect(() => {
		if (meta && page > meta.pageCount) void setParams({ page: meta.pageCount });
	}, [meta, page, setParams]);

	const onPage = reminders.find(reminder => reminder.id === openId);
	const linked = useReminder(openId, list.data !== undefined && !onPage);
	// A reminder that is gone (deleted, or a wrong id in the link) closes the panel instead of showing the last copy it had.
	const gone = linked.isError;
	const opened = onPage ?? (gone ? undefined : linked.data);
	useEffect(() => {
		if (gone) void setOpenId(null);
	}, [gone, setOpenId]);
	const targets = useTargets(onPage || !linked.data ? reminders : [...reminders, linked.data]);
	const sent = sentList.data?.data ?? [];
	// With a selection "Mark as read" applies to it; otherwise to every reminder that already fired.
	const toRead = checked.size > 0 ? [...checked].filter(id => reminders.some(reminder => reminder.id === id && reminder.status !== 'dismissed')) : sent.map(reminder => reminder.id);

	const markRead = () =>
		dismiss.mutate(toRead, {
			onError: fail,
			onSuccess: () => {
				setChecked(new Set());
				toast.success(t('reminders.toast.dismissed'));
			},
		});
	const toggle = (id: string, on: boolean) =>
		setChecked(current => {
			const next = new Set(current);
			if (on) next.add(id);
			else next.delete(id);
			return next;
		});

	return (
		<Fragment>
			<Page.Header>
				<div>
					<Page.Title>{t('reminders.title')}</Page.Title>
					<Page.Description>{t('reminders.subtitle')}</Page.Description>
				</div>
				<Page.Actions>
					<span className='relative flex size-10 items-center justify-center text-muted-foreground'>
						<Bell aria-hidden className='size-6' />
						{sent.length > 0 && <span aria-label={t('reminders.unread')} className='absolute top-2 right-2 size-2 rounded-full bg-destructive' role='img' />}
					</span>
					<Button className={listStyles.pillTrigger} disabled={toRead.length === 0 || dismiss.isPending} loading={dismiss.isPending} onClick={markRead} variant='secondary'>
						<Button.Text>{checked.size > 0 ? t('reminders.markSelected', { count: toRead.length }) : t('reminders.markAll')}</Button.Text>
					</Button>
				</Page.Actions>
			</Page.Header>
			<Page.Body className='min-h-0 flex-1 gap-4'>
				<div className={cn(listStyles.card, 'flex flex-wrap items-center justify-between gap-3 p-2')}>
					<StatusTabs
						ariaLabel={t('reminders.tabs.label')}
						counts={meta?.counts}
						onChange={next => void setParams({ page: 1, tab: next })}
						tabs={tabs.map(value => ({ label: t(`reminders.tabs.${value}`), value }))}
						value={tab}
					/>
					<ListSearch
						clearLabel={t('reminders.search.clear')}
						label={t('reminders.search.label')}
						onChange={value => void setParams({ page: 1, q: value })}
						placeholder={t('reminders.search.placeholder')}
						value={q}
					/>
				</div>
				<div className={cn('grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] gap-4', opened ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]' : '')}>
					<div className='flex min-h-0 flex-col gap-3'>
						<div className='min-h-0 flex-1 overflow-y-auto'>
							{list.isPending ? (
								<Skeleton className='gap-3' label={t('reminders.title')}>
									{[0, 1, 2, 3].map(index => (
										<Skeleton.Item className='h-16 w-full rounded-2xl' key={index} />
									))}
								</Skeleton>
							) : list.isError ? (
								<div className='flex flex-col items-center gap-3 p-10 text-center'>
									<p className='text-sm text-muted-foreground'>{t('reminders.loadError')}</p>
									<Button onClick={() => void list.refetch()} variant='secondary'>
										<Button.Text>{t('reminders.retry')}</Button.Text>
									</Button>
								</div>
							) : reminders.length === 0 ? (
								<ApplicationState.EmptyState
									className={cn(listStyles.card, 'h-full')}
									description={meta?.counts.all === 0 ? t('reminders.empty.description') : null}
									icon={Bell}
									title={meta?.counts.all === 0 ? t('reminders.empty.title') : t('reminders.noResults')}
								/>
							) : (
								<ul className='flex flex-col gap-3'>
									{reminders.map(reminder => (
										<ReminderRow
											checked={checked.has(reminder.id)}
											info={targets.get(targetId(reminder))}
											key={reminder.id}
											onCheckedChange={on => toggle(reminder.id, on)}
											onDelete={() => remove.mutate(reminder.id, { onError: fail, onSuccess: () => toast.success(t('reminders.toast.deleted')) })}
											onDismiss={() => dismiss.mutate([reminder.id], { onError: fail, onSuccess: () => toast.success(t('reminders.toast.dismissed')) })}
											onOpen={() => void setOpenId(reminder.id)}
											reminder={reminder}
											selected={reminder.id === openId}
										/>
									))}
								</ul>
							)}
						</div>
						{meta && meta.pageCount > 1 && (
							<Pagination
								className='mx-auto shrink-0'
								onPageChange={next => void setParams({ page: next })}
								page={meta.page}
								pageCount={meta.pageCount}
								pageSize={PAGE_SIZE}
								showEdges={false}
								showSummary={false}
								total={meta.total}
							/>
						)}
						{list.data && sentList.data && list.data.meta.counts.all > 0 && sent.length === 0 && (
							<div className={cn(listStyles.card, 'flex items-center gap-3 px-4 py-3')}>
								<span className='flex size-10 items-center justify-center rounded-full border border-success text-success'>
									<Check aria-hidden className='size-5' />
								</span>
								<div className='flex flex-col'>
									<Typography.Span className='text-sm font-medium'>{t('reminders.caughtUp.title')}</Typography.Span>
									<Typography.Span className='text-xs text-muted-foreground'>{t('reminders.caughtUp.subtitle')}</Typography.Span>
								</div>
							</div>
						)}
					</div>
					{opened && <ReminderDetail info={targets.get(targetId(opened))} key={opened.id} onClose={() => void setOpenId(null)} reminder={opened} />}
				</div>
			</Page.Body>
		</Fragment>
	);
}
