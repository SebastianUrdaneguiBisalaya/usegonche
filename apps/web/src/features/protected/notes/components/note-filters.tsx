import { FolderKanban, Tag } from 'lucide-react';
import { useTranslate } from '~/hooks/use-translate';
import { FilterChip } from '../../shared/filter-chip';
import { IdSelect } from '../../shared/id-select';
import { TaskFilter } from './task-combobox';

/** A filter's slot: it grows to share the line, never below a readable width or above a calm one. */
const FIELD = 'min-w-0 flex-1 basis-40 lg:max-w-56';
/** Project and tag selects at the height of the "All" chip and the task combobox (42px), instead of the 36px list control. */
const SELECT = 'h-[2.625rem] min-w-0';

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

	// One row from `lg` up (search | All, Project, Tag, Task); below it the filters wrap, two or three per line.
	return (
		<div className='flex min-w-0 flex-1 flex-wrap items-center gap-3 lg:flex-nowrap lg:justify-between'>
			<FilterChip active={!filtered} className='h-[2.625rem] shrink-0 rounded-xl' count={count} hasCount={!filtered} label={t('notes.filters.all')} onClick={onClear} />
			<div className={FIELD}>
				<IdSelect
					allLabel={t('notes.filters.project.all')}
					className={SELECT}
					icon={FolderKanban}
					label={t('notes.filters.project.label')}
					onChange={onProjectChange}
					options={projects}
					value={project}
				/>
			</div>
			<div className={FIELD}>
				<IdSelect allLabel={t('notes.filters.tag.all')} className={SELECT} icon={Tag} label={t('notes.filters.tag.label')} onChange={onTagChange} options={tags} value={tag} />
			</div>
			<div className={FIELD}>
				<TaskFilter onChange={onTaskChange} value={task} />
			</div>
		</div>
	);
}
