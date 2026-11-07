import { ListChecks, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/actions-controls/button/button';
import { Progress } from '~/components/ui/data-display/progress/progress';
import { Checkbox } from '~/components/ui/forms-inputs/checkbox/checkbox';
import { Combobox } from '~/components/ui/forms-inputs/combobox/combobox';
import { Skeleton } from '~/components/ui/foundations/skeleton/skeleton';
import { Typography } from '~/components/ui/foundations/typography/typography';
import { ApplicationState } from '~/components/ui/overlays-feedback/application-state/application-state';
import { cn } from '~/components/ui/utils/tailwind/cn';
import { useTranslate } from '~/hooks/use-translate';
import { listStyles } from '../../shared/styles';
import { PriorityPill } from '../../tasks/components/task-pills';
import { type DayItem, useOpenTasks } from '../api';
import { formatMinutes } from '../format';

interface PlanCardProps {
	className?: string;
	error: boolean;
	isLoading: boolean;
	isToday: boolean;
	items: DayItem[];
	onAdd: (taskId: string) => void;
	onRemove: (taskId: string) => void;
	onRetry: () => void;
	onToggleDone: (taskId: string, done: boolean) => void;
	pending: boolean;
}

/** The day's plan: progress, the planned tasks (check one to finish it) and a picker to add more. */
export function PlanCard({ className, error, isLoading, isToday, items, onAdd, onRemove, onRetry, onToggleDone, pending }: PlanCardProps) {
	const t = useTranslate();
	const done = items.filter(item => item.task.status === 'done').length;

	return (
		<section className={cn(listStyles.card, 'flex flex-col gap-4 p-5', className)}>
			<div className='flex items-center justify-between gap-3'>
				<Typography.H3 className='text-lg font-semibold'>{isToday ? t('today.plan.titleToday') : t('today.plan.title')}</Typography.H3>
				{!isLoading && !error && <Typography.Span className='text-sm text-muted-foreground tabular-nums'>{t('today.plan.count', { done, total: items.length })}</Typography.Span>}
			</div>
			<Progress aria-label={t('today.plan.progress')} className='h-1.5' max={Math.max(items.length, 1)} value={done}>
				<Progress.Indicator />
			</Progress>

			<div className={cn('flex min-h-64 flex-1 basis-0 flex-col overflow-y-auto', (error || items.length === 0) && !isLoading && 'justify-center')}>
				{isLoading ? (
					<div className='flex flex-col gap-3'>
						{[0, 1, 2].map(row => (
							<Skeleton className='h-8 w-full' key={row} />
						))}
					</div>
				) : error ? (
					<ApplicationState.ErrorState
						actions={
							<Button onClick={onRetry} variant='secondary'>
								<Button.Text>{t('today.error.retry')}</Button.Text>
							</Button>
						}
						description={null}
						title={t('today.error.title')}
					/>
				) : items.length === 0 ? (
					<ApplicationState.EmptyState description={t('today.empty.description')} icon={ListChecks} title={t('today.empty.title')} />
				) : (
					<ul className='flex flex-col'>
						{items.map(({ id, task }) => {
							const finished = task.status === 'done';
							return (
								<li className='group flex items-center gap-3 rounded-lg px-1 py-2 hover:bg-foreground/[0.04]' key={id}>
									<Checkbox
										checked={finished}
										className='min-w-0 flex-1'
										disabled={pending || task.status === 'cancelled'}
										onCheckedChange={checked => onToggleDone(task.id, checked)}
									>
										<Checkbox.Toggle />
										<Checkbox.Label className={finished || task.status === 'cancelled' ? 'truncate text-muted-foreground line-through' : 'truncate'}>{task.title}</Checkbox.Label>
									</Checkbox>
									{task.estimatedMinutes !== null && <Typography.Span className='text-xs text-muted-foreground tabular-nums'>{formatMinutes(task.estimatedMinutes)}</Typography.Span>}
									<PriorityPill priority={task.priority} />
									<Button
										aria-label={t('today.plan.remove', { title: task.title })}
										className='size-7 rounded-full p-0 text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
										disabled={pending}
										onClick={() => onRemove(task.id)}
										variant='ghost'
									>
										<Button.Icon icon={X} />
									</Button>
								</li>
							);
						})}
					</ul>
				)}
			</div>

			{!isLoading && !error && <AddTask exclude={items.map(item => item.task.id)} onAdd={onAdd} pending={pending} />}
		</section>
	);
}

/** "Add task…": type to filter your open tasks by title and pick one to plan. */
function AddTask({ exclude, onAdd, pending }: { exclude: string[]; onAdd: (taskId: string) => void; pending: boolean }) {
	const t = useTranslate();
	const [query, setQuery] = useState('');
	const [version, setVersion] = useState(0);
	const open = useOpenTasks();
	const needle = query.trim().toLowerCase();
	const options = (open.data ?? []).filter(task => !exclude.includes(task.id) && task.title.toLowerCase().includes(needle)).slice(0, 8);

	return (
		<Combobox
			disabled={pending}
			filter={false}
			key={version}
			loading={open.isPending}
			onInputChange={setQuery}
			onValueChange={id => {
				if (!id) return;
				onAdd(id);
				setQuery('');
				setVersion(current => current + 1);
			}}
			value={null}
		>
			<Combobox.Input aria-label={t('today.plan.add')} containerClassName={listStyles.pillInput} placeholder={t('today.plan.add')} />
			<Combobox.Content emptyMessage={t('today.plan.addEmpty')}>
				{options.map(task => (
					<Combobox.Item key={task.id} label={task.title} value={task.id}>
						{task.title}
					</Combobox.Item>
				))}
			</Combobox.Content>
		</Combobox>
	);
}
