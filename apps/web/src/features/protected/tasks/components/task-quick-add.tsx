import { CalendarDays, Clock, FolderKanban, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Pill } from '~/components/ui/data-display/pill/pill';
import { useTranslate } from '~/hooks/use-translate';
import { getApiErrorMessage } from '~/lib/api-error';
import { fromDateOnly } from '../../shared/dates';
import { QuickAdd } from '../../shared/quick-add';
import { QuickAddDialog } from '../../shared/quick-add-dialog';
import { useDateTime } from '../../shared/use-datetime';
import { useCreateTask, useDeleteTask } from '../api';
import { priorityClass } from '../display';
import { type ParsedTask, parseQuickTask } from '../quick-parse';
import { useFormatDay } from './task-pills';

const TITLE_MAX = 200;

interface TaskQuickAddProps {
	projects: readonly { id: string; title: string }[];
}

/** Project whose name is the typed one: an exact match first, then the only project that starts with, or contains, the text. */
export function matchProject(projects: readonly { id: string; title: string }[], name: string | undefined): { id: string; title: string } | undefined {
	if (!name) return undefined;
	const wanted = name.toLowerCase();
	const exact = projects.find(project => project.title.toLowerCase() === wanted);
	if (exact) return exact;
	const starting = projects.filter(project => project.title.toLowerCase().startsWith(wanted));
	if (starting.length === 1) return starting[0];
	const containing = projects.filter(project => project.title.toLowerCase().includes(wanted));
	return containing.length === 1 ? containing[0] : undefined;
}

/** The "+" button (and `c` key) that opens the bar that creates a task from a line like "Review contract #project !high tomorrow ~1h" and shows what it understood before it is sent. */
export function TaskQuickAdd({ projects }: TaskQuickAddProps) {
	const t = useTranslate();
	const formatDay = useFormatDay();
	// Relative dates ("today", "tomorrow", weekdays) count from the user's day in their stored time zone, not the browser's clock.
	const { today } = useDateTime();
	const todayValue = today();
	const todayDate = useMemo(() => fromDateOnly(todayValue) ?? new Date(), [todayValue]);
	const create = useCreateTask();
	const remove = useDeleteTask();
	const [text, setText] = useState('');
	const parsed = useMemo<ParsedTask>(() => parseQuickTask(text, todayDate), [text, todayDate]);
	const project = matchProject(projects, parsed.projectName);
	const understood = Boolean(parsed.projectName || parsed.priority || parsed.dueDate || parsed.estimatedMinutes);

	const submit = async (line: string) => {
		const task = parseQuickTask(line, fromDateOnly(today()) ?? todayDate);
		if (!task.title) {
			toast.error(t('tasks.quickAdd.needsTitle'));
			throw new Error('empty_title');
		}
		const matched = matchProject(projects, task.projectName);
		try {
			const created = await create.mutateAsync({
				title: task.title.slice(0, TITLE_MAX),
				...(matched && { projectId: matched.id }),
				...(task.priority && { priority: task.priority }),
				...(task.dueDate && { dueDate: task.dueDate }),
				...(task.estimatedMinutes && { estimatedMinutes: task.estimatedMinutes }),
			});
			toast.success(t('tasks.toast.created'), { action: { label: t('tasks.toast.undo'), onClick: () => remove.mutate(created.id) } });
		} catch (error) {
			toast.error(getApiErrorMessage(error));
			throw error;
		}
	};

	return (
		<QuickAddDialog label={t('tasks.quickAdd.label')}>
			<div className='flex flex-col gap-2'>
				<QuickAdd
					icon={Sparkles}
					label={t('tasks.quickAdd.label')}
					maxLength={TITLE_MAX + 80}
					onSubmit={submit}
					onTextChange={setText}
					pending={create.isPending}
					placeholder={t('tasks.quickAdd.placeholder')}
					submitLabel={t('tasks.quickAdd.submit')}
				/>
				{understood && (
					<div aria-live='polite' className='flex flex-wrap items-center gap-2 px-2'>
						<span className='text-xs text-muted-foreground'>{t('tasks.quickAdd.understood')}</span>
						{parsed.projectName && (
							<Pill variant={project ? 'outline' : 'warning'}>
								<FolderKanban aria-hidden className='size-3' />
								<Pill.Text>{project ? project.title : t('tasks.quickAdd.projectNotFound', { name: parsed.projectName })}</Pill.Text>
							</Pill>
						)}
						{parsed.priority && (
							<Pill className={priorityClass[parsed.priority]}>
								<Pill.Text>{t(`tasks.priority.${parsed.priority}`)}</Pill.Text>
							</Pill>
						)}
						{parsed.dueDate && (
							<Pill variant='outline'>
								<CalendarDays aria-hidden className='size-3' />
								<Pill.Text>{formatDay(parsed.dueDate)}</Pill.Text>
							</Pill>
						)}
						{parsed.estimatedMinutes && (
							<Pill variant='outline'>
								<Clock aria-hidden className='size-3' />
								<Pill.Text>{t('tasks.quickAdd.estimate', { minutes: parsed.estimatedMinutes })}</Pill.Text>
							</Pill>
						)}
					</div>
				)}
			</div>
		</QuickAddDialog>
	);
}
