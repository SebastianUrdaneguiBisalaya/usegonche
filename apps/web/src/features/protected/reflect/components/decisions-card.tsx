import { CalendarDays, ListChecks } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/actions-controls/button/button';
import { Pill } from '~/components/ui/data-display/pill/pill';
import { Checkbox } from '~/components/ui/forms-inputs/checkbox/checkbox';
import { DatePicker } from '~/components/ui/forms-inputs/date-picker/date-picker';
import { Typography } from '~/components/ui/foundations/typography/typography';
import { cn } from '~/components/ui/utils/tailwind/cn';
import { useLanguage } from '~/hooks/use-language';
import { useTranslate } from '~/hooks/use-translate';
import { getApiErrorMessage } from '~/lib/api-error';
import { apiDateOnly, fromDateOnly, toDateOnly } from '../../shared/dates';
import { listStyles } from '../../shared/styles';
import { useTasksByIds } from '../../shared/task-lookup';
import { usePickerLang } from '../../tasks/components/task-pills';
import { priorityClass } from '../../tasks/display';
import { type DecisionAction, type Review, useApplyDecisions } from '../api';
import { nextDay } from '../period';

const ACTIONS: readonly DecisionAction[] = ['carry_over', 'reschedule', 'drop', 'keep'];
const needsDate = (action: DecisionAction) => action === 'carry_over' || action === 'reschedule';

type Choice = { action: DecisionAction; date: string };

/** Decide what happens to each task that was planned and is still open. Nothing changes until "Apply decisions". */
export function DecisionsCard({ review }: { review: Review }) {
	const t = useTranslate();
	const { locale } = useLanguage();
	const pickerLang = usePickerLang();
	const apply = useApplyDecisions(review.id);
	const [choices, setChoices] = useState<ReadonlyMap<string, Choice>>(new Map());

	const defaultDate = nextDay(apiDateOnly(review.periodEnd));
	const decided = useMemo(() => new Map(review.decisions.map(decision => [decision.taskId, decision.action as DecisionAction])), [review.decisions]);
	const pending = review.prefill?.pending ?? [];
	// A closed review has no live list: its recorded decisions are shown with the titles of their tasks.
	const closedIds = review.prefill ? [] : review.decisions.map(decision => decision.taskId);
	const closedTasks = useTasksByIds(closedIds);
	const rows = review.prefill
		? pending.map(task => ({ id: task.id, priority: task.priority, title: task.title }))
		: (closedTasks.data ?? []).map(task => ({ id: task.id, priority: task.priority, title: task.title }));

	const open = review.status === 'open';
	const undecided = rows.filter(row => !decided.has(row.id));
	const selected = [...choices.entries()].filter(([id]) => undecided.some(row => row.id === id));

	const set = (id: string, action: DecisionAction) => setChoices(current => new Map(current).set(id, { action, date: needsDate(action) ? (current.get(id)?.date ?? defaultDate) : '' }));
	const clear = (id: string) =>
		setChoices(current => {
			const next = new Map(current);
			next.delete(id);
			return next;
		});

	const submit = () =>
		apply.mutate(
			selected.map(([taskId, choice]) => ({ action: choice.action, taskId, ...(needsDate(choice.action) && { date: choice.date }) })),
			{
				onError: error => toast.error(getApiErrorMessage(error)),
				onSuccess: () => {
					setChoices(new Map());
					toast.success(t('reflect.decisions.applied'));
				},
			}
		);

	return (
		<section className={cn(listStyles.card, 'flex flex-col gap-4 p-5')}>
			<div className='flex flex-wrap items-start justify-between gap-3'>
				<div className='flex flex-col gap-1'>
					<span className='flex items-center gap-3 text-lg font-semibold'>
						<ListChecks aria-hidden className='size-5 text-muted-foreground' />
						{t('reflect.decisions.title')}
					</span>
					<Typography.Span className='text-sm text-muted-foreground'>{t('reflect.decisions.subtitle')}</Typography.Span>
				</div>
				{open && undecided.length > 0 && (
					<div className='flex items-center gap-2'>
						<Typography.Span className='text-sm text-muted-foreground'>{t('reflect.decisions.selected', { count: selected.length })}</Typography.Span>
						<Button className='rounded-full' onClick={() => undecided.forEach(row => set(row.id, 'keep'))} variant='secondary'>
							<Button.Text>{t('reflect.decisions.keepAll')}</Button.Text>
						</Button>
						<Button className='rounded-full' disabled={selected.length === 0 || apply.isPending} loading={apply.isPending} onClick={submit} variant='secondary'>
							<Button.Text>{t('reflect.decisions.apply', { count: selected.length })}</Button.Text>
						</Button>
					</div>
				)}
			</div>
			{rows.length === 0 ? (
				<Typography.Span className='text-sm text-muted-foreground'>{t(open ? 'reflect.decisions.empty' : 'reflect.decisions.noneTaken')}</Typography.Span>
			) : (
				<ul className='flex flex-col divide-y divide-border border-t border-border'>
					{rows.map(row => {
						const done = decided.get(row.id);
						const choice = choices.get(row.id);
						return (
							<li className='flex flex-wrap items-center gap-x-4 gap-y-2 py-3' key={row.id}>
								<div className='flex min-w-0 flex-1 items-center gap-3'>
									{open && !done && (
										<Checkbox checked={Boolean(choice)} onCheckedChange={checked => (checked ? set(row.id, 'keep') : clear(row.id))}>
											<Checkbox.Toggle />
											<Checkbox.Label className='sr-only'>{t('reflect.decisions.select', { title: row.title })}</Checkbox.Label>
										</Checkbox>
									)}
									<Typography.Span className='truncate text-sm font-medium' title={row.title}>
										{row.title}
									</Typography.Span>
									<Pill className={priorityClass[row.priority]}>
										<Pill.Text>{t(`tasks.priority.${row.priority}`)}</Pill.Text>
									</Pill>
								</div>
								{done ? (
									<Pill variant='outline'>
										<Pill.Text>{t(`reflect.decisions.action.${done}`)}</Pill.Text>
									</Pill>
								) : (
									open && (
										<div className='flex flex-wrap items-center gap-1'>
											{choice && needsDate(choice.action) && (
												<DatePicker.Root
													lang={pickerLang}
													locale={locale}
													onChange={date => date && setChoices(current => new Map(current).set(row.id, { action: choice.action, date: toDateOnly(date) }))}
													value={fromDateOnly(choice.date)}
												>
													<DatePicker.Trigger
														aria-label={t('reflect.decisions.date')}
														className='h-auto gap-1.5 rounded-full px-3 py-1.5 text-xs'
														placeholder={t('reflect.decisions.date')}
													/>
													<DatePicker.Content />
												</DatePicker.Root>
											)}
											{ACTIONS.map(action => (
												<Button
													aria-pressed={choice?.action === action}
													className={cn('rounded-full px-3 py-1.5 text-xs', choice?.action === action ? 'bg-foreground/[0.12]' : '')}
													key={action}
													onClick={() => set(row.id, action)}
													variant='ghost'
												>
													{(action === 'carry_over' || action === 'reschedule') && <Button.Icon icon={CalendarDays} />}
													<Button.Text>{t(`reflect.decisions.action.${action}`)}</Button.Text>
												</Button>
											))}
										</div>
									)
								)}
							</li>
						);
					})}
				</ul>
			)}
		</section>
	);
}
