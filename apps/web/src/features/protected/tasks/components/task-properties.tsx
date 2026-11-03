import { CalendarClock, CalendarDays, CircleDot, Clock, FlagTriangleRight, FolderKanban, type LucideIcon, Tag, Target } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Combobox } from '~/components/ui/forms-inputs/combobox/combobox';
import { Input } from '~/components/ui/forms-inputs/input/input';
import { Select } from '~/components/ui/forms-inputs/select/select';
import { Icon } from '~/components/ui/foundations/icon/icon';
import { useTranslate } from '~/hooks/use-translate';
import { listStyles } from '../../shared/styles';
import { useCreateTag, useTagOptions } from '../../shared/tags';
import { type Task, type UpdateTaskBody, useGoalOptions, useProjectOptions } from '../api';
import { DueDate, PriorityMenu, TaskStatusMenu, taskDay } from './task-pills';

const NONE = '__none';

function Row({ children, icon, label }: { children: React.ReactNode; icon: LucideIcon; label: string }) {
	return (
		<div className='grid grid-cols-[8.5rem_1fr] items-center gap-3'>
			<span className='flex items-center gap-2 text-sm text-muted-foreground'>
				<Icon aria-hidden icon={icon} size='sm' />
				{label}
			</span>
			<div className='min-w-0'>{children}</div>
		</div>
	);
}

interface TaskPropertiesProps {
	onChange: (changes: UpdateTaskBody) => void;
	task: Task;
}

/** Every field of the task as a row you change in place: each change is one `PATCH /tasks/:id`, there is no form to submit. */
export function TaskProperties({ onChange, task }: TaskPropertiesProps) {
	const t = useTranslate();
	const projects = useProjectOptions();
	const goals = useGoalOptions();
	const tags = useTagOptions();
	const createTag = useCreateTag();
	const [estimate, setEstimate] = useState(task.estimatedMinutes ? String(task.estimatedMinutes) : '');
	useEffect(() => setEstimate(task.estimatedMinutes ? String(task.estimatedMinutes) : ''), [task.estimatedMinutes]);

	const commitEstimate = () => {
		const minutes = estimate.trim() === '' ? null : Number.parseInt(estimate, 10);
		if (minutes !== null && (!Number.isFinite(minutes) || minutes < 1 || minutes > 100_000)) return setEstimate(task.estimatedMinutes ? String(task.estimatedMinutes) : '');
		if (minutes !== (task.estimatedMinutes ?? null)) onChange({ estimatedMinutes: minutes });
	};

	return (
		<div className='flex flex-col gap-3'>
			<Row icon={CircleDot} label={t('tasks.columns.status')}>
				<TaskStatusMenu onChange={status => onChange({ status })} status={task.status} />
			</Row>
			<Row icon={FlagTriangleRight} label={t('tasks.columns.priority')}>
				<PriorityMenu onChange={priority => onChange({ priority })} priority={task.priority} />
			</Row>
			<Row icon={CalendarDays} label={t('tasks.properties.start')}>
				<DueDate
					ariaLabel={t('tasks.properties.start')}
					emptyLabel={t('tasks.properties.noStart')}
					onChange={date => onChange({ startDate: date })}
					status='todo'
					value={taskDay(task.startDate)}
				/>
			</Row>
			<Row icon={CalendarClock} label={t('tasks.columns.due')}>
				<DueDate onChange={date => onChange({ dueDate: date })} status={task.status} value={taskDay(task.dueDate)} />
			</Row>
			<Row icon={Clock} label={t('tasks.properties.estimate')}>
				<Input className='max-w-40 rounded-xl border-border bg-transparent px-3 py-1.5 focus-within:border-border-strong'>
					<Input.Field
						aria-label={t('tasks.properties.estimate')}
						inputMode='numeric'
						onBlur={commitEstimate}
						onChange={event => setEstimate(event.target.value.replace(/\D/g, ''))}
						onKeyDown={event => event.key === 'Enter' && event.currentTarget.blur()}
						placeholder={t('tasks.properties.minutes')}
						value={estimate}
					/>
				</Input>
			</Row>
			<Row icon={FolderKanban} label={t('tasks.columns.project')}>
				<Select.Root onChange={next => onChange({ projectId: next === NONE ? null : next })} value={task.projectId ?? NONE}>
					<Select.Trigger aria-label={t('tasks.columns.project')} className={`${listStyles.pillTrigger} w-full`}>
						<Select.Value />
					</Select.Trigger>
					<Select.Content>
						<Select.ItemList>
							<Select.Item value={NONE}>{t('tasks.form.project.none')}</Select.Item>
							{(projects.data ?? []).map(project => (
								<Select.Item key={project.id} value={project.id}>
									{project.title}
								</Select.Item>
							))}
						</Select.ItemList>
					</Select.Content>
				</Select.Root>
			</Row>
			<Row icon={Target} label={t('tasks.properties.goal')}>
				<Select.Root onChange={next => onChange({ goalId: next === NONE ? null : next })} value={task.goalId ?? NONE}>
					<Select.Trigger aria-label={t('tasks.properties.goal')} className={`${listStyles.pillTrigger} w-full`}>
						<Select.Value />
					</Select.Trigger>
					<Select.Content>
						<Select.ItemList>
							<Select.Item value={NONE}>{t('tasks.form.goal.none')}</Select.Item>
							{(goals.data ?? []).map(goal => (
								<Select.Item key={goal.id} value={goal.id}>
									{goal.title}
								</Select.Item>
							))}
						</Select.ItemList>
					</Select.Content>
				</Select.Root>
			</Row>
			<Row icon={Tag} label={t('tasks.columns.tags')}>
				<Combobox
					multiple
					onCreate={name => createTag.mutate({ name }, { onSuccess: tag => onChange({ tagIds: [...task.tags.map(item => item.id), tag.id] }) })}
					onValueChange={ids => onChange({ tagIds: ids })}
					value={task.tags.map(tag => tag.id)}
				>
					<Combobox.Input containerClassName={listStyles.field} placeholder={t('tasks.form.tags.placeholder')} />
					<Combobox.Content createLabel={name => t('tasks.form.tags.create', { name })} emptyMessage={t('tasks.form.tags.empty')}>
						{(tags.data ?? []).map(tag => (
							<Combobox.Item key={tag.id} label={tag.name} value={tag.id}>
								{tag.name}
							</Combobox.Item>
						))}
					</Combobox.Content>
				</Combobox>
			</Row>
		</div>
	);
}
