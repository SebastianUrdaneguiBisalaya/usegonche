import { CalendarClock, ChevronDown, CircleDot, Flag, FolderKanban, X } from 'lucide-react';
import { Button } from '~/components/ui/actions-controls/button/button';
import { Icon } from '~/components/ui/foundations/icon/icon';
import { Dropdown } from '~/components/ui/overlays-feedback/dropdown/dropdown';
import { cn } from '~/components/ui/utils/tailwind/cn';
import { useTranslate } from '~/hooks/use-translate';
import type { BulkChanges } from '../api';
import { priorityDot, statusDot } from '../display';
import { taskPriorities, taskStatuses } from '../search-params';

interface TaskBulkBarProps {
	count: number;
	onApply: (changes: BulkChanges) => void;
	onClear: () => void;
	pending: boolean;
	projects: readonly { id: string; title: string }[];
}

const pill = 'gap-2 rounded-full border-border bg-foreground/[0.03] px-4 py-2';

/** "3 selected" plus what can be applied to all of them at once: status, priority, project and moving their dates (one `PATCH /tasks/bulk`). */
export function TaskBulkBar({ count, onApply, onClear, pending, projects }: TaskBulkBarProps) {
	const t = useTranslate();

	return (
		<div className='flex min-w-0 flex-wrap items-center gap-2'>
			<span className='mr-2 text-sm font-medium tabular-nums'>{t('tasks.selection.count', { count })}</span>
			<Dropdown>
				<Dropdown.Trigger>
					<Button className={pill} disabled={pending} variant='secondary'>
						<Button.Icon icon={CircleDot} />
						<Button.Text className='text-xs'>{t('tasks.bulk.status')}</Button.Text>
						<Button.Icon icon={ChevronDown} />
					</Button>
				</Dropdown.Trigger>
				<Dropdown.Content align='start'>
					{taskStatuses.map(status => (
						<Dropdown.Item key={status} onSelect={() => onApply({ status })}>
							<span aria-hidden className={cn('size-2 rounded-full', statusDot[status])} />
							{t(`tasks.status.${status}`)}
						</Dropdown.Item>
					))}
				</Dropdown.Content>
			</Dropdown>
			<Dropdown>
				<Dropdown.Trigger>
					<Button className={pill} disabled={pending} variant='secondary'>
						<Button.Icon icon={Flag} />
						<Button.Text className='text-xs'>{t('tasks.bulk.priority')}</Button.Text>
						<Button.Icon icon={ChevronDown} />
					</Button>
				</Dropdown.Trigger>
				<Dropdown.Content align='start'>
					{taskPriorities.map(priority => (
						<Dropdown.Item key={priority} onSelect={() => onApply({ priority })}>
							<span aria-hidden className={cn('size-2 rounded-full', priorityDot[priority])} />
							{t(`tasks.priority.${priority}`)}
						</Dropdown.Item>
					))}
				</Dropdown.Content>
			</Dropdown>
			<Dropdown>
				<Dropdown.Trigger>
					<Button className={pill} disabled={pending} variant='secondary'>
						<Button.Icon icon={FolderKanban} />
						<Button.Text className='text-xs'>{t('tasks.bulk.project')}</Button.Text>
						<Button.Icon icon={ChevronDown} />
					</Button>
				</Dropdown.Trigger>
				<Dropdown.Content align='start' className='max-h-72 overflow-y-auto'>
					<Dropdown.Item onSelect={() => onApply({ projectId: null })}>{t('tasks.bulk.noProject')}</Dropdown.Item>
					{projects.map(project => (
						<Dropdown.Item key={project.id} onSelect={() => onApply({ projectId: project.id })}>
							{project.title}
						</Dropdown.Item>
					))}
				</Dropdown.Content>
			</Dropdown>
			<Dropdown>
				<Dropdown.Trigger>
					<Button className={pill} disabled={pending} variant='secondary'>
						<Button.Icon icon={CalendarClock} />
						<Button.Text className='text-xs'>{t('tasks.bulk.moveDates')}</Button.Text>
						<Button.Icon icon={ChevronDown} />
					</Button>
				</Dropdown.Trigger>
				<Dropdown.Content align='start'>
					<Dropdown.Item onSelect={() => onApply({ shiftDays: -1 })}>{t('tasks.bulk.shift.dayBack')}</Dropdown.Item>
					<Dropdown.Item onSelect={() => onApply({ shiftDays: 1 })}>{t('tasks.bulk.shift.dayForward')}</Dropdown.Item>
					<Dropdown.Item onSelect={() => onApply({ shiftDays: 7 })}>{t('tasks.bulk.shift.weekForward')}</Dropdown.Item>
					<Dropdown.Item onSelect={() => onApply({ dueDate: null })}>{t('tasks.bulk.shift.clear')}</Dropdown.Item>
				</Dropdown.Content>
			</Dropdown>
			<Button className='gap-2 rounded-full px-3 py-2 text-muted-foreground' onClick={onClear} variant='ghost'>
				<Icon aria-hidden icon={X} size='sm' />
				<Button.Text className='text-xs'>{t('tasks.actions.clearSelection')}</Button.Text>
			</Button>
		</div>
	);
}
