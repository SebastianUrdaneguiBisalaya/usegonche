import { FolderKanban, Tag } from 'lucide-react';
import { useTranslate } from '~/hooks/use-translate';
import { FilterChip } from '../../shared/filter-chip';
import { IdSelect } from '../../shared/id-select';
import { TaskFilter } from './task-combobox';

interface Option {
	id: string;
	name: string;
}

interface NoteFiltersProps {
	/** Notes in total, shown next to "All" while no filter narrows the list. */
	count: number | undefined;
	filtered: boolean;
	onClear: () => void;
	onProjectChange: (id: string) => void;
	onTagChange: (id: string) => void;
	onTaskChange: (id: string) => void;
	project: string;
	projects: readonly Option[];
	tag: string;
	tags: readonly Option[];
	task: string;
}

/** "All" (clears the filters) and the three filters the API supports: project, tag and linked task. */
export function NoteFilters({ count, filtered, onClear, onProjectChange, onTagChange, onTaskChange, project, projects, tag, tags, task }: NoteFiltersProps) {
	const t = useTranslate();

	return (
		<div className='flex flex-wrap items-center gap-3'>
			<FilterChip active={!filtered} count={count} hasCount={!filtered} label={t('notes.filters.all')} onClick={onClear} />
			<IdSelect
				allLabel={t('notes.filters.project.all')}
				className='min-w-36'
				icon={FolderKanban}
				label={t('notes.filters.project.label')}
				onChange={onProjectChange}
				options={projects}
				value={project}
			/>
			<IdSelect allLabel={t('notes.filters.tag.all')} className='min-w-36' icon={Tag} label={t('notes.filters.tag.label')} onChange={onTagChange} options={tags} value={tag} />
			<TaskFilter onChange={onTaskChange} value={task} />
		</div>
	);
}
