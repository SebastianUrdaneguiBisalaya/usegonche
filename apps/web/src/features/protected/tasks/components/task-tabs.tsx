import { ArrowRightLeft, CalendarClock, CircleDot, Flag, FolderKanban, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '~/components/ui/actions-controls/button/button';
import { Tabs } from '~/components/ui/data-display/tabs/tabs';
import { Timeline, type TimelineTone } from '~/components/ui/data-display/timeline/timeline';
import { Skeleton } from '~/components/ui/foundations/skeleton/skeleton';
import { Typography } from '~/components/ui/foundations/typography/typography';
import { useLanguage } from '~/hooks/use-language';
import { useTranslate } from '~/hooks/use-translate';
import { NewNoteModal } from '../../notes/components/new-note-modal';
import { DrawerSection } from '../../shared/drawer-section';
import { useProjectOptions } from '../../shared/projects';
import { formatRelative } from '../../shared/relative-time';
import { useDateTime } from '../../shared/use-datetime';
import { type Task, useTaskBlocks, useTaskFiles, useTaskHistory, useTaskNotes } from '../api';

const formatSize = (bytes: number): string => (bytes < 1024 ? `${bytes} B` : bytes < 1_048_576 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1_048_576).toFixed(1)} MB`);

const day = (iso: string | null): string => (iso ? iso.slice(0, 10) : '');

function History({ task }: { task: Task }) {
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

	return (
		<Timeline>
			{(history.data ?? []).map(event => {
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
			<Timeline.Item icon={Plus} time={formatRelative(task.createdAt, locale)} title={t('tasks.history.created')} />
		</Timeline>
	);
}

/** The four tabs under the task: its history, notes, files and time (the estimate and the time blocks planned for it). */
export function TaskTabs({ task }: { task: Task }) {
	const t = useTranslate();
	const { locale } = useLanguage();
	const notes = useTaskNotes(task.id, true);
	const [newNote, setNewNote] = useState(false);
	const files = useTaskFiles(task.id, true);
	const blocks = useTaskBlocks(task.id, true);
	const { formatDateTime } = useDateTime();
	const retry = t('tasks.drawer.retry');
	const loadError = t('tasks.drawer.loadError');

	return (
		<Tabs defaultValue='history'>
			<Tabs.List aria-label={t('tasks.drawer.tabsLabel')} className='gap-1'>
				{(['history', 'notes', 'files', 'time'] as const).map(tab => (
					<Tabs.Trigger key={tab} value={tab}>
						<Tabs.TriggerTitle>{t(`tasks.drawer.${tab}`)}</Tabs.TriggerTitle>
					</Tabs.Trigger>
				))}
			</Tabs.List>
			<Tabs.Content className='w-full pt-5' value='history'>
				<History task={task} />
			</Tabs.Content>
			<Tabs.Content className='w-full pt-5' value='notes'>
				<div className='mb-3 flex justify-end'>
					<Button onClick={() => setNewNote(true)} type='button' variant='secondary'>
						<Button.Icon icon={Plus} />
						<Button.Text>{t('notes.new')}</Button.Text>
					</Button>
				</div>
				<DrawerSection
					empty={t('tasks.drawer.notesEmpty')}
					error={notes.isError}
					errorLabel={loadError}
					isLoading={notes.isPending}
					items={notes.data}
					onRetry={() => void notes.refetch()}
					render={note => (
						<>
							<span className='min-w-0 truncate'>{note.title}</span>
							<span className='shrink-0 text-xs text-muted-foreground'>{formatRelative(note.updatedAt, locale)}</span>
						</>
					)}
					retryLabel={retry}
				/>
			</Tabs.Content>
			<Tabs.Content className='w-full pt-5' value='files'>
				<DrawerSection
					empty={t('tasks.drawer.filesEmpty')}
					error={files.isError}
					errorLabel={loadError}
					isLoading={files.isPending}
					items={files.data}
					onRetry={() => void files.refetch()}
					render={file => (
						<>
							<span className='min-w-0 truncate'>{file.name}</span>
							<span className='shrink-0 text-xs text-muted-foreground'>{formatSize(file.sizeBytes)}</span>
						</>
					)}
					retryLabel={retry}
				/>
			</Tabs.Content>
			<Tabs.Content className='flex w-full flex-col gap-3 pt-5' value='time'>
				<Typography.Span className='text-sm text-muted-foreground'>
					{task.estimatedMinutes ? t('tasks.drawer.estimate', { minutes: task.estimatedMinutes }) : t('tasks.drawer.noEstimate')}
				</Typography.Span>
				<DrawerSection
					empty={t('tasks.drawer.blocksEmpty')}
					error={blocks.isError}
					errorLabel={loadError}
					isLoading={blocks.isPending}
					items={blocks.data}
					onRetry={() => void blocks.refetch()}
					render={block => (
						<>
							<span className='min-w-0 truncate'>{`${formatDateTime(block.plannedStart)} – ${formatDateTime(block.plannedEnd)}`}</span>
							<span className='shrink-0 text-xs text-muted-foreground'>{t(`tasks.drawer.blockStatus.${block.status}`)}</span>
						</>
					)}
					retryLabel={retry}
				/>
			</Tabs.Content>
			<NewNoteModal links={{ taskIds: [task.id] }} onOpenChange={setNewNote} open={newNote} />
		</Tabs>
	);
}
