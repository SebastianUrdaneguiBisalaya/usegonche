import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/actions-controls/button/button';
import { Tabs } from '~/components/ui/data-display/tabs/tabs';
import { Typography } from '~/components/ui/foundations/typography/typography';
import { useLanguage } from '~/hooks/use-language';
import { useTranslate } from '~/hooks/use-translate';
import { AttachmentsCard } from '../../notes/components/attachments-card';
import { NewNoteModal } from '../../notes/components/new-note-modal';
import { DrawerSection } from '../../shared/drawer-section';
import { formatRelative } from '../../shared/relative-time';
import { useDateTime } from '../../shared/use-datetime';
import { type Task, useTaskBlocks, useTaskNotes } from '../api';
import { TaskHistory } from './task-history';

/** The four tabs under the task: its history, notes, files and time (the estimate and the time blocks planned for it). */
export function TaskTabs({ task }: { task: Task }) {
	const t = useTranslate();
	const { locale } = useLanguage();
	const notes = useTaskNotes(task.id, true);
	const [newNote, setNewNote] = useState(false);
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
			<Tabs.Content className='w-full pt-3' value='history'>
				<TaskHistory task={task} />
			</Tabs.Content>
			<Tabs.Content className='w-full pt-3' value='notes'>
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
			<Tabs.Content className='w-full pt-3' value='files'>
				<AttachmentsCard target={{ taskId: task.id }} />
			</Tabs.Content>
			<Tabs.Content className='flex w-full flex-col gap-3 pt-3' value='time'>
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
