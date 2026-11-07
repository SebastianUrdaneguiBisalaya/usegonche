import { useMemo, useState } from 'react';
import { Combobox } from '~/components/ui/forms-inputs/combobox/combobox';
import { cn } from '~/components/ui/utils/tailwind/cn';
import { useTranslate } from '~/hooks/use-translate';
import { listStyles } from '../../shared/styles';
import { useTaskSearch, useTasksByIds } from '../../shared/task-lookup';

/** The options of a task picker: the tasks already chosen (so each shows its title) followed by what the typed text found. */
function useTaskOptions(selectedIds: readonly string[]) {
	const [query, setQuery] = useState('');
	const search = useTaskSearch(query);
	const selected = useTasksByIds(selectedIds);
	const options = useMemo(() => {
		const byId = new Map<string, string>();
		for (const task of selected.data ?? []) byId.set(task.id, task.title);
		for (const hit of search.data ?? []) if (!byId.has(hit.id)) byId.set(hit.id, hit.title);
		return [...byId].map(([id, title]) => ({ id, title }));
	}, [search.data, selected.data]);
	return { loading: query.trim() !== '' && search.isFetching, options, setQuery };
}

interface LinkedTasksProps {
	onChange: (ids: string[]) => void;
	value: string[];
}

/** Picks the tasks a note links to: type to find tasks by title, pick several. */
export function LinkedTasks({ onChange, value }: LinkedTasksProps) {
	const t = useTranslate();
	const { loading, options, setQuery } = useTaskOptions(value);

	return (
		<Combobox className='h-full' filter={false} loading={loading} multiple onInputChange={setQuery} onValueChange={onChange} value={value}>
			<Combobox.Input
				aria-label={t('notes.meta.tasks.label')}
				containerClassName={cn(listStyles.pillInput, 'flex-1')}
				placeholder={value.length === 0 ? t('notes.meta.tasks.add') : t('notes.meta.tasks.search')}
			/>
			<Combobox.Content emptyMessage={t('notes.meta.tasks.empty')}>
				{options.map(task => (
					<Combobox.Item key={task.id} label={task.title} value={task.id}>
						{task.title}
					</Combobox.Item>
				))}
			</Combobox.Content>
		</Combobox>
	);
}

interface TaskFilterProps {
	onChange: (id: string) => void;
	/** The task id of the URL, or empty for "any". */
	value: string;
}

/** The "Task" filter of the list: one task (found by title) whose notes are listed. */
export function TaskFilter({ onChange, value }: TaskFilterProps) {
	const t = useTranslate();
	const { loading, options, setQuery } = useTaskOptions(value ? [value] : []);

	return (
		<Combobox filter={false} loading={loading} onInputChange={setQuery} onValueChange={next => onChange(next ?? '')} value={value || null}>
			<Combobox.Input
				aria-label={t('notes.filters.task.label')}
				className='min-w-0'
				containerClassName={cn(listStyles.pillInput, 'min-h-[2.625rem] w-full px-4')}
				placeholder={t('notes.filters.task.all')}
			/>
			<Combobox.Content emptyMessage={t('notes.meta.tasks.empty')}>
				{options.map(task => (
					<Combobox.Item key={task.id} label={task.title} value={task.id}>
						{task.title}
					</Combobox.Item>
				))}
			</Combobox.Content>
		</Combobox>
	);
}
