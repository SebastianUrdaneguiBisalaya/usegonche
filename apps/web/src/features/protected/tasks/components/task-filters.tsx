import { CalendarDays, FolderKanban, OctagonAlert, Tag, Target, TimerOff } from 'lucide-react';
import { Select } from '~/components/ui/forms-inputs/select/select';
import { Icon } from '~/components/ui/foundations/icon/icon';
import { Skeleton } from '~/components/ui/foundations/skeleton/skeleton';
import { useTranslate } from '~/hooks/use-translate';
import { listStyles } from '../../shared/styles';
import { statusColor, statusIcon } from '../display';
import { NO_PROJECT, type TaskDue, type TaskStatus, taskDues, taskStatuses } from '../search-params';

const ALL = '__all';

interface ChipProps {
	active: boolean;
	count: number | undefined;
	icon: React.ReactNode;
	label: string;
	onClick: () => void;
	tone?: 'danger';
}

/** A toggle chip with its counter (a pulsing placeholder until the counts arrive). */
function Chip({ active, count, icon, label, onClick, tone }: ChipProps) {
	return (
		<button
			aria-pressed={active}
			className={`flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
				active ? 'border-border-strong bg-foreground/[0.06]' : 'border-border hover:bg-foreground/[0.04]'
			} ${tone === 'danger' && active ? 'text-destructive' : ''}`}
			onClick={onClick}
			type='button'
		>
			{icon}
			{label}
			{count === undefined ? (
				<Skeleton className='gap-0'>
					<Skeleton.Item className='h-4 w-6 rounded-full' />
				</Skeleton>
			) : (
				<span className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${tone === 'danger' && count > 0 ? 'bg-destructive/10 text-destructive' : 'bg-muted'}`}>{count}</span>
			)}
		</button>
	);
}

interface TaskChipsProps {
	blocked: boolean;
	counts: (Record<TaskStatus, number> & { blocked: number; overdue: number }) | undefined;
	due: TaskDue;
	onBlockedChange: (blocked: boolean) => void;
	onDueChange: (due: TaskDue) => void;
	onStatusChange: (status: TaskStatus[]) => void;
	status: readonly TaskStatus[];
}

/** One chip per status (several can be on), then the two quick filters that need attention: overdue and blocked. */
export function TaskChips({ blocked, counts, due, onBlockedChange, onDueChange, onStatusChange, status }: TaskChipsProps) {
	const t = useTranslate();

	const toggle = (value: TaskStatus) => {
		const next = status.includes(value) ? status.filter(item => item !== value) : taskStatuses.filter(item => item === value || status.includes(item));
		// At least one status stays on: with none the board would be empty and the list would answer every status anyway.
		if (next.length > 0) onStatusChange(next);
	};

	return (
		<div aria-label={t('tasks.chips.label')} className='flex flex-wrap items-center gap-2' role='group'>
			{taskStatuses.map(value => (
				<Chip
					active={status.includes(value)}
					count={counts?.[value]}
					icon={<Icon aria-hidden className={statusColor[value]} icon={statusIcon[value]} size='sm' />}
					key={value}
					label={t(`tasks.status.${value}`)}
					onClick={() => toggle(value)}
				/>
			))}
			<span aria-hidden className='mx-1 hidden h-6 w-px bg-border sm:block' />
			<Chip
				active={due === 'overdue'}
				count={counts?.overdue}
				icon={<Icon aria-hidden className='text-destructive' icon={TimerOff} size='sm' />}
				label={t('tasks.chips.overdue')}
				onClick={() => onDueChange(due === 'overdue' ? 'any' : 'overdue')}
				tone='danger'
			/>
			<Chip
				active={blocked}
				count={counts?.blocked}
				icon={<Icon aria-hidden className='text-destructive' icon={OctagonAlert} size='sm' />}
				label={t('tasks.chips.blocked')}
				onClick={() => onBlockedChange(!blocked)}
				tone='danger'
			/>
		</div>
	);
}

interface IdSelectProps {
	allLabel: string;
	/** Extra option after "all" (e.g. "No project"), as `[value, label]`. */
	extra?: readonly [string, string];
	icon: typeof Target;
	label: string;
	onChange: (id: string) => void;
	options: readonly { id: string; name: string }[];
	value: string;
}

function IdSelect({ allLabel, extra, icon, label, onChange, options, value }: IdSelectProps) {
	return (
		<Select.Root onChange={next => onChange(next === ALL ? '' : next)} value={value || ALL}>
			<Select.Trigger aria-label={label} className={`${listStyles.pillTrigger} min-w-40`}>
				<span className='flex min-w-0 items-center gap-2'>
					<Icon aria-hidden className='text-muted-foreground' icon={icon} size='sm' />
					<Select.Value />
				</span>
			</Select.Trigger>
			<Select.Content>
				<Select.ItemList>
					<Select.Item value={ALL}>{allLabel}</Select.Item>
					{extra && <Select.Item value={extra[0]}>{extra[1]}</Select.Item>}
					{options.map(option => (
						<Select.Item key={option.id} value={option.id}>
							{option.name}
						</Select.Item>
					))}
				</Select.ItemList>
			</Select.Content>
		</Select.Root>
	);
}

interface FilterProps {
	onChange: (id: string) => void;
	options: readonly { id: string; name: string }[];
	value: string;
}

export function ProjectFilter({ onChange, options, value }: FilterProps) {
	const t = useTranslate();
	return (
		<IdSelect
			allLabel={t('tasks.filters.project.all')}
			extra={[NO_PROJECT, t('tasks.filters.project.none')]}
			icon={FolderKanban}
			label={t('tasks.filters.project.label')}
			onChange={onChange}
			options={options}
			value={value}
		/>
	);
}

export function GoalFilter({ onChange, options, value }: FilterProps) {
	const t = useTranslate();
	return <IdSelect allLabel={t('tasks.filters.goal.all')} icon={Target} label={t('tasks.filters.goal.label')} onChange={onChange} options={options} value={value} />;
}

export function TagFilter({ onChange, options, value }: FilterProps) {
	const t = useTranslate();
	return <IdSelect allLabel={t('tasks.filters.tag.all')} icon={Tag} label={t('tasks.filters.tag.label')} onChange={onChange} options={options} value={value} />;
}

/** "Any date" / today / next 7 days / overdue / no date. */
export function DueFilter({ onChange, value }: { onChange: (due: TaskDue) => void; value: TaskDue }) {
	const t = useTranslate();
	return (
		<Select.Root onChange={next => onChange(next as TaskDue)} value={value}>
			<Select.Trigger aria-label={t('tasks.filters.due.label')} className={`${listStyles.pillTrigger} min-w-40`}>
				<span className='flex min-w-0 items-center gap-2'>
					<Icon aria-hidden className='text-muted-foreground' icon={CalendarDays} size='sm' />
					<Select.Value />
				</span>
			</Select.Trigger>
			<Select.Content>
				<Select.ItemList>
					{taskDues.map(due => (
						<Select.Item key={due} value={due}>
							{t(`tasks.filters.due.${due}`)}
						</Select.Item>
					))}
				</Select.ItemList>
			</Select.Content>
		</Select.Root>
	);
}
