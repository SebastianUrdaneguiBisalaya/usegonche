import { ArrowRight, CalendarDays, MoreHorizontal, Plus } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router';
import { Button } from '~/components/ui/actions-controls/button/button';
import { Kanban, type KanbanItem } from '~/components/ui/data-display/kanban/kanban';
import { Progress } from '~/components/ui/data-display/progress/progress';
import { Icon } from '~/components/ui/foundations/icon/icon';
import { Skeleton } from '~/components/ui/foundations/skeleton/skeleton';
import { Typography } from '~/components/ui/foundations/typography/typography';
import { Dropdown } from '~/components/ui/overlays-feedback/dropdown/dropdown';
import { useTranslate } from '~/hooks/use-translate';
import { ListEmpty } from '../../shared/list-table';
import { listStyles } from '../../shared/styles';
import type { Task } from '../api';
import { daysUntil, isOpen, statusColor, statusDot, statusIcon, taskIcon } from '../display';
import { type TaskPriority, type TaskStatus, taskPriorities, taskStatuses } from '../search-params';
import { BlockedTag, PriorityPill, taskDay, useFormatDay } from './task-pills';

interface TaskBoardProps {
	error: boolean;
	/** Tasks of the board's working set that did not fit under its ceiling. */
	hidden: number;
	isLoading: boolean;
	/** The list view with the same filters, where those tasks can be reached. */
	listHref: string;
	onAdd: (status: TaskStatus) => void;
	onMove: (task: Task, status: TaskStatus) => void;
	onOpen: (task: Task) => void;
	onRetry: () => void;
	onSetPriority: (task: Task, priority: TaskPriority) => void;
	/** The statuses to show as columns, in board order. */
	statuses: readonly TaskStatus[];
	tasks: Task[];
}

const cardSurface = 'rounded-2xl border-border bg-foreground/[0.04] p-3.5 shadow-none hover:bg-foreground/[0.06]';

function TaskCard({ onOpen, onSetPriority, task }: { onOpen: (task: Task) => void; onSetPriority: (task: Task, priority: TaskPriority) => void; task: Task }) {
	const t = useTranslate();
	const formatDay = useFormatDay();
	const due = taskDay(task.dueDate);
	const overdue = due !== '' && isOpen(task.status) && daysUntil(due) < 0;
	const { done, total } = task.progress;
	const finished = task.status === 'done';

	return (
		<div className='flex flex-col gap-3' onClick={() => onOpen(task)}>
			<div className='flex items-start gap-3'>
				<span
					aria-hidden
					className={`flex size-10 shrink-0 items-center justify-center rounded-xl border border-border ${finished ? 'bg-success/15 text-success' : 'bg-foreground/[0.06] text-muted-foreground'}`}
				>
					<Icon icon={finished ? statusIcon.done : taskIcon(task.id)} size='md' />
				</span>
				<Typography.Span className={`min-w-0 flex-1 text-sm font-medium leading-snug ${finished ? 'text-muted-foreground' : ''}`} title={task.title}>
					<span className='line-clamp-2'>{task.title}</span>
				</Typography.Span>
				<div onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
					<Dropdown>
						<Dropdown.Trigger>
							<Button aria-label={t('tasks.actions.rowMenu')} className='size-7 rounded-full p-0 text-muted-foreground' size='icon' variant='ghost'>
								<Button.Icon icon={MoreHorizontal} />
							</Button>
						</Dropdown.Trigger>
						<Dropdown.Content align='end'>
							<Dropdown.Item onSelect={() => onOpen(task)}>{t('tasks.actions.open')}</Dropdown.Item>
							{taskPriorities
								.filter(priority => priority !== task.priority)
								.map(priority => (
									<Dropdown.Item key={priority} onSelect={() => onSetPriority(task, priority)}>
										{t('tasks.actions.setPriority', { priority: t(`tasks.priority.${priority}`) })}
									</Dropdown.Item>
								))}
						</Dropdown.Content>
					</Dropdown>
				</div>
			</div>
			{total > 0 && (
				<Progress aria-label={t('tasks.card.subtasks', { done, total })} title={t('tasks.card.subtasks', { done, total })} value={Math.round((done / total) * 100)}>
					<Progress.Indicator className='h-1' />
					<Progress.Label className='w-10 text-right text-[0.7rem]' />
				</Progress>
			)}
			<div className='flex flex-wrap items-center gap-2'>
				{due && (
					<span className={`flex items-center gap-1.5 text-xs tabular-nums ${overdue ? 'text-destructive' : 'text-muted-foreground'}`}>
						<Icon aria-hidden icon={CalendarDays} size='xs' />
						{formatDay(due)}
					</span>
				)}
				<span className='ml-auto flex items-center gap-1.5'>
					{task.blocked && <BlockedTag openBlockers={task.openBlockers} />}
					<PriorityPill priority={task.priority} />
				</span>
			</div>
		</div>
	);
}

function BoardSkeleton({ columns }: { columns: number }) {
	return (
		<div className='flex min-h-0 flex-1 gap-4 overflow-x-auto pb-2'>
			{taskStatuses.slice(0, columns).map(column => (
				<Skeleton className={`${listStyles.card} w-80 shrink-0 gap-3 p-4`} key={column}>
					<Skeleton.Item className='h-5 w-32' />
					{[0, 1, 2].map(card => (
						<Skeleton.Item className='h-24 w-full rounded-2xl' key={card} />
					))}
				</Skeleton>
			))}
		</div>
	);
}

/**
 * The board: a column per status, draggable cards (dropping one in Done completes the task) and an "Add task" button per column. It shows a working set,
 * not every task: when some of it is cut by the ceiling, a link says how many and opens the list.
 */
export function TaskBoard({ error, hidden, isLoading, listHref, onAdd, onMove, onOpen, onRetry, onSetPriority, statuses, tasks }: TaskBoardProps) {
	const t = useTranslate();
	const ordered = useMemo(() => taskStatuses.filter(status => statuses.includes(status)), [statuses]);
	const byId = useMemo(() => new Map(tasks.map(task => [task.id, task])), [tasks]);
	const items = useMemo<KanbanItem[]>(() => tasks.map(task => ({ columnId: task.status, id: task.id, title: task.title, tone: task.blocked ? 'destructive' : 'default' })), [tasks]);
	const lang = useMemo(
		() => ({
			cardInstructions: t('tasks.board.instructions'),
			cardRoleDescription: t('tasks.board.card'),
			emptyColumn: t('tasks.board.empty'),
		}),
		[t]
	);

	if (isLoading) return <BoardSkeleton columns={Math.max(ordered.length, 1)} />;
	if (error) return <ListEmpty error errorTitle={t('tasks.error.title')} icon={Plus} onRetry={onRetry} retryLabel={t('tasks.error.retry')} />;

	return (
		<div className='flex min-h-0 flex-1 flex-col gap-3'>
			<Kanban.Root
				className='min-h-0 flex-1'
				dateFormat={date => date.toLocaleDateString()}
				items={items}
				lang={lang}
				onItemMove={({ itemId, toColumnId }) => {
					const task = byId.get(itemId);
					if (task && task.status !== toColumnId) onMove(task, toColumnId as TaskStatus);
				}}
			>
				<Kanban.Board className='min-h-0 flex-1 gap-4 overflow-x-auto pb-2'>
					{ordered.map(status => (
						<Kanban.Column
							action={
								<Button
									aria-label={t('tasks.board.add', { status: t(`tasks.status.${status}`) })}
									className='size-7 rounded-full p-0 text-muted-foreground'
									onClick={() => onAdd(status)}
									size='icon'
									variant='ghost'
								>
									<Button.Icon icon={Plus} />
								</Button>
							}
							cardClassName={cardSurface}
							className={`${listStyles.card} w-80 shrink-0 border-l! p-4 first:pl-4 last:pr-4`}
							icon={<span aria-hidden className={`size-2.5 rounded-full ${statusDot[status]} ${statusColor[status]}`} />}
							id={status}
							key={status}
							renderItem={item => {
								const task = byId.get(item.id);
								return task ? <TaskCard onOpen={onOpen} onSetPriority={onSetPriority} task={task} /> : null;
							}}
							title={t(`tasks.status.${status}`)}
						>
							<Button className='justify-start gap-2 rounded-xl px-2 text-muted-foreground' onClick={() => onAdd(status)} variant='ghost'>
								<Button.Icon icon={Plus} />
								<Button.Text className='text-sm'>{t('tasks.board.addTask')}</Button.Text>
							</Button>
						</Kanban.Column>
					))}
				</Kanban.Board>
			</Kanban.Root>
			{hidden > 0 && (
				<Link className={`${listStyles.card} flex items-center justify-center gap-2 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground`} to={listHref}>
					{t(hidden === 1 ? 'tasks.board.more_one' : 'tasks.board.more_other', { count: hidden })}
					<ArrowRight aria-hidden className='size-4' />
				</Link>
			)}
		</div>
	);
}
