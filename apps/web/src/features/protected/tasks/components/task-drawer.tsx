import { useHotkeys } from '@usehotkeys/react';
import { Ban, Check, RotateCcw, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/actions-controls/button/button';
import { Input } from '~/components/ui/forms-inputs/input/input';
import { Icon } from '~/components/ui/foundations/icon/icon';
import { Kbd } from '~/components/ui/foundations/kbd/kbd';
import { Skeleton } from '~/components/ui/foundations/skeleton/skeleton';
import { Layout } from '~/components/ui/layout/layout/layout';
import { ConfirmDialog } from '~/components/ui/overlays-feedback/confirm-dialog/confirm-dialog';
import { Drawer } from '~/components/ui/overlays-feedback/drawer/drawer';
import { useRetained } from '~/hooks/use-retained';
import { useTranslate } from '~/hooks/use-translate';
import { TargetReminder } from '../../reminders/components/target-reminder';
import { shortcutKeys } from '../../shared/shortcut-keys';
import { useDateTime } from '../../shared/use-datetime';
import { type Task, type UpdateTaskBody, useDeleteTask, useTask, useUpdateTask } from '../api';
import { statusIcon, taskIcon } from '../display';
import type { TaskStatus } from '../search-params';
import { BlockersSection } from './blockers-section';
import { DependenciesSection } from './dependencies-section';
import { SubtasksSection } from './subtasks-section';
import { TaskDescription } from './task-description';
import { BlockedTag, PriorityPill } from './task-pills';
import { TaskProperties } from './task-properties';
import { TaskTabs } from './task-tabs';

const COMPLETE_COMBO = 'mod+enter';

interface TaskDrawerProps {
	/** A task already loaded by a list (shown at once while the fresh one arrives). */
	initial: Task | undefined;
	onClose: () => void;
	/** Opens another task in this same drawer (a dependency, a subtask). */
	onOpenTask: (id: string) => void;
	/** Changes the status through the page, which shows the "Undo" toast. */
	onSetStatus: (task: Task, status: TaskStatus) => void;
	taskId: string | undefined;
}

function DrawerSkeleton() {
	return (
		<Drawer.Body className='flex flex-col gap-5'>
			<Skeleton className='gap-4'>
				<Skeleton.Item className='h-10 w-3/4' />
				<Skeleton.Item className='h-28 w-full rounded-xl' />
				<Skeleton.Item className='h-6 w-full' />
				<Skeleton.Item className='h-6 w-full' />
				<Skeleton.Item className='h-6 w-2/3' />
			</Skeleton>
		</Drawer.Body>
	);
}

function Title({ onCommit, task }: { onCommit: (title: string) => void; task: Task }) {
	const t = useTranslate();
	const [value, setValue] = useState(task.title);
	useEffect(() => setValue(task.title), [task.title]);

	const commit = () => {
		const title = value.trim();
		if (title === '' || title === task.title) return setValue(task.title);
		onCommit(title);
	};

	return (
		<Input className='min-w-0 flex-1 rounded-xl border-transparent bg-transparent px-2 py-1 hover:border-border focus-within:border-border-strong'>
			<Input.Field
				aria-label={t('tasks.form.title.label')}
				autoComplete='off'
				className='text-lg font-semibold'
				maxLength={200}
				onBlur={commit}
				onChange={event => setValue(event.target.value)}
				onKeyDown={event => event.key === 'Enter' && event.currentTarget.blur()}
				value={value}
			/>
		</Input>
	);
}

function Body({ onClose, onOpenTask, onSetStatus, task }: Omit<TaskDrawerProps, 'initial' | 'taskId'> & { task: Task }) {
	const t = useTranslate();
	const update = useUpdateTask();
	const remove = useDeleteTask();
	const [confirmingDelete, setConfirmingDelete] = useState(false);
	// The editor owns the text while it is open: it only starts from what was saved (a refetch must not overwrite what is being typed).
	const [initialDescription] = useState(task.description ?? '');
	const finished = task.status === 'done';
	const { formatDate } = useDateTime();

	const change = (changes: UpdateTaskBody) => {
		if (changes.status) return onSetStatus(task, changes.status);
		update.mutate({ changes, id: task.id }, { onSuccess: () => toast.success(t('tasks.toast.updated')) });
	};

	useHotkeys(COMPLETE_COMBO, () => onSetStatus(task, finished ? 'todo' : 'done'), { group: 'tasks', ignoreInputs: false, label: t('tasks.drawer.completeShortcut') });

	return (
		<>
			<Drawer.Header className='items-start'>
				<Layout.HStack className='min-w-0 flex-1' gap='md'>
					<span aria-hidden className='flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-foreground/[0.06] text-muted-foreground'>
						<Icon icon={finished ? statusIcon.done : taskIcon(task.id)} size='lg' />
					</span>
					<Layout.Stack className='min-w-0 flex-1' gap='xs'>
						<Layout.HStack gap='sm' wrap>
							<PriorityPill priority={task.priority} />
							{task.blocked && <BlockedTag openBlockers={task.openBlockers} />}
						</Layout.HStack>
						<Title onCommit={title => change({ title })} task={task} />
						<Drawer.Title className='sr-only'>{task.title}</Drawer.Title>
						<Drawer.Description>{t('tasks.drawer.created', { date: formatDate(task.createdAt) })}</Drawer.Description>
					</Layout.Stack>
				</Layout.HStack>
				<Drawer.Close>
					<Button aria-label={t('tasks.drawer.close')} className='size-9 shrink-0 rounded-full p-0' onClick={onClose} size='icon' variant='ghost'>
						<Button.Icon icon={X} />
					</Button>
				</Drawer.Close>
			</Drawer.Header>
			<Drawer.Body className='flex flex-col gap-6'>
				<TaskDescription key={task.id} markdown={initialDescription} onSave={markdown => update.mutateAsync({ changes: { description: markdown === '' ? null : markdown }, id: task.id })} />
				<TaskProperties onChange={change} task={task} />
				<SubtasksSection onOpen={onOpenTask} task={task} />
				<DependenciesSection onOpen={onOpenTask} task={task} />
				<BlockersSection task={task} />
				<TargetReminder target={{ taskId: task.id }} />
				<TaskTabs task={task} />
			</Drawer.Body>
			<Drawer.Footer className='flex flex-wrap items-center justify-between gap-2'>
				<Layout.HStack gap='sm' wrap>
					<Button className='rounded-full' onClick={() => onSetStatus(task, finished ? 'todo' : 'done')} title={t('tasks.drawer.completeShortcut')}>
						<Button.Icon icon={finished ? RotateCcw : Check} />
						<Button.Text>{finished ? t('tasks.drawer.reopen') : t('tasks.drawer.complete')}</Button.Text>
						<span aria-hidden className='ml-1 hidden items-center gap-0.5 sm:flex'>
							{shortcutKeys(COMPLETE_COMBO).map(key => (
								<Kbd key={key}>{key}</Kbd>
							))}
						</span>
					</Button>
					{task.status !== 'cancelled' && (
						<Button className='rounded-full' onClick={() => onSetStatus(task, 'cancelled')} variant='secondary'>
							<Button.Icon icon={Ban} />
							<Button.Text>{t('tasks.drawer.cancel')}</Button.Text>
						</Button>
					)}
				</Layout.HStack>
				<Button className='rounded-full text-destructive' onClick={() => setConfirmingDelete(true)} variant='ghost'>
					<Button.Icon icon={Trash2} />
					<Button.Text>{t('tasks.actions.delete')}</Button.Text>
				</Button>
			</Drawer.Footer>
			<ConfirmDialog.Root
				lang={{ cancel: t('tasks.delete.cancel'), confirm: t('tasks.delete.confirm') }}
				onConfirm={async () => {
					await remove.mutateAsync(task.id);
					toast.success(t('tasks.toast.deleted'));
					onClose();
				}}
				onOpenChange={setConfirmingDelete}
				open={confirmingDelete}
				variant='destructive'
			>
				<ConfirmDialog.Content>
					<ConfirmDialog.Icon icon={Trash2} />
					<ConfirmDialog.Title>{t('tasks.delete.title')}</ConfirmDialog.Title>
					<ConfirmDialog.Description>{t('tasks.delete.description', { title: task.title })}</ConfirmDialog.Description>
					<ConfirmDialog.Footer>
						<ConfirmDialog.Cancel />
						<ConfirmDialog.Confirm />
					</ConfirmDialog.Footer>
				</ConfirmDialog.Content>
			</ConfirmDialog.Root>
		</>
	);
}

/**
 * Detail of a task, in a drawer: everything is edited in place (title, Markdown description, status, priority, dates, project, goal, tags),
 * with the subtasks checklist, dependencies ("waits for" / "blocks"), blockers and the history, notes, files and time tabs.
 */
export function TaskDrawer({ initial, onClose, onOpenTask, onSetStatus, taskId }: TaskDrawerProps) {
	const t = useTranslate();
	const fresh = useTask(taskId);
	// Keeps the last task while the drawer slides out, so it does not go blank mid-animation.
	const shown = useRetained(fresh.data ?? (initial?.id === taskId ? initial : undefined));

	return (
		<Drawer.Root onOpenChange={open => !open && onClose()} open={taskId !== undefined}>
			<Drawer.Content className='sm:max-w-xl'>
				{shown ? (
					<Body key={shown.id} onClose={onClose} onOpenTask={onOpenTask} onSetStatus={onSetStatus} task={shown} />
				) : fresh.isError ? (
					<Drawer.Body className='py-10 text-center text-sm text-muted-foreground'>{t('tasks.drawer.loadError')}</Drawer.Body>
				) : (
					<DrawerSkeleton />
				)}
			</Drawer.Content>
		</Drawer.Root>
	);
}
