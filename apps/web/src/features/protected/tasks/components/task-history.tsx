import { ArrowRightLeft, CalendarClock, CircleDot, Flag, FolderKanban, Plus } from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '~/components/ui/actions-controls/button/button';
import { Timeline, type TimelineTone } from '~/components/ui/data-display/timeline/timeline';
import { Skeleton } from '~/components/ui/foundations/skeleton/skeleton';
import { Typography } from '~/components/ui/foundations/typography/typography';
import { useLanguage } from '~/hooks/use-language';
import { useTranslate } from '~/hooks/use-translate';
import { useProjectOptions } from '../../shared/projects';
import { formatRelative } from '../../shared/relative-time';
import { useDateTime } from '../../shared/use-datetime';
import { type Task, useTaskHistory } from '../api';

const day = (iso: string | null): string => (iso ? iso.slice(0, 10) : '');

/** Read-only log of what changed in a task (status, priority, due date, project, reschedules), newest first, a page at a time. The creation closes the list. */
export function TaskHistory({ task }: { task: Task }) {
	const t = useTranslate();
	const { locale } = useLanguage();
	const history = useTaskHistory(task.id, true);
	const projects = useProjectOptions();
	const projectTitle = useMemo(() => new Map((projects.data ?? []).map(project => [project.id, project.title])), [projects.data]);
	const { formatDateTime } = useDateTime();

	if (history.isPending) {
		return (
			<Skeleton className='gap-4 pl-6'>
				{[0, 1, 2].map(key => (
					<Skeleton.Item className='h-10 w-full rounded-lg' key={key} />
				))}
			</Skeleton>
		);
	}
	if (history.isError) return <Typography.Span className='block py-10 text-center text-sm text-muted-foreground'>{t('tasks.drawer.loadError')}</Typography.Span>;

	const events = history.data.pages.flatMap(page => page.data);
	const total = history.data.pages[0]?.meta.total ?? events.length;

	return (
		<div className='flex flex-col gap-4'>
			<Timeline>
				{events.map(event => {
					const none = t('tasks.history.none');
					let title = '';
					let tone: TimelineTone = 'default';
					let icon = CircleDot;
					if (event.type === 'status_changed') {
						title = t('tasks.history.status', { from: t(`tasks.status.${event.fromStatus ?? 'todo'}`), to: t(`tasks.status.${event.toStatus ?? 'todo'}`) });
						tone = event.toStatus === 'done' ? 'success' : 'default';
					} else if (event.type === 'priority_changed') {
						title = t('tasks.history.priority', { from: t(`tasks.priority.${event.fromPriority ?? 'medium'}`), to: t(`tasks.priority.${event.toPriority ?? 'medium'}`) });
						icon = Flag;
						tone = event.toPriority === 'urgent' ? 'warning' : 'default';
					} else if (event.type === 'due_changed') {
						title = t('tasks.history.due', { from: day(event.fromDueDate) || none, to: day(event.toDueDate) || none });
						icon = CalendarClock;
					} else if (event.type === 'project_changed') {
						title = t('tasks.history.project', {
							from: (event.fromProjectId && projectTitle.get(event.fromProjectId)) || none,
							to: (event.toProjectId && projectTitle.get(event.toProjectId)) || none,
						});
						icon = FolderKanban;
					} else {
						title = t('tasks.history.rescheduled', {
							from: event.fromStart ? formatDateTime(event.fromStart) : none,
							to: event.toStart ? formatDateTime(event.toStart) : none,
						});
						icon = ArrowRightLeft;
					}
					return <Timeline.Item icon={icon} key={event.id} time={formatRelative(event.occurredAt, locale)} title={title} tone={tone} />;
				})}
				{!history.hasNextPage && <Timeline.Item icon={Plus} time={formatRelative(task.createdAt, locale)} title={t('tasks.history.created')} />}
			</Timeline>
			{history.hasNextPage && (
				<div className='flex items-center justify-between gap-3 pl-6'>
					<Typography.Span className='text-xs text-muted-foreground'>{t('tasks.history.shown', { shown: events.length, total })}</Typography.Span>
					<Button disabled={history.isFetchingNextPage} onClick={() => void history.fetchNextPage()} type='button' variant='secondary'>
						<Button.Text>{t('tasks.history.more')}</Button.Text>
					</Button>
				</div>
			)}
		</div>
	);
}
