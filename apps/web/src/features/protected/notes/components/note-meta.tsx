import { FolderKanban } from 'lucide-react';
import { Combobox } from '~/components/ui/forms-inputs/combobox/combobox';
import { Select } from '~/components/ui/forms-inputs/select/select';
import { Icon } from '~/components/ui/foundations/icon/icon';
import { cn } from '~/components/ui/utils/tailwind/cn';
import { useTranslate } from '~/hooks/use-translate';
import { useProjectOptions } from '../../shared/projects';
import { listStyles } from '../../shared/styles';
import { useCreateTag, useTagOptions } from '../../shared/tags';
import { LinkedTasks } from './task-combobox';

const NONE = '__none';

export interface NoteLinks {
	projectId: string | null;
	tagIds: string[];
	taskIds: string[];
}

interface NoteMetaProps {
	onChange: (links: NoteLinks) => void;
	value: NoteLinks;
}

/** What a note is linked to, as one row of pickers: its project, its tags and its tasks (all searchable). They are part of the draft until Save. */
export function NoteMeta({ onChange, value }: NoteMetaProps) {
	const t = useTranslate();
	const projects = useProjectOptions();
	const tags = useTagOptions();
	const createTag = useCreateTag();

	return (
		<div className='flex flex-wrap items-stretch gap-3'>
			<Select.Root onChange={next => onChange({ ...value, projectId: next === NONE ? null : next })} value={value.projectId ?? NONE}>
				<Select.Trigger aria-label={t('notes.meta.project.label')} className={cn(listStyles.pillTrigger, 'w-44')}>
					<span className='flex min-w-0 items-center gap-2'>
						<Icon aria-hidden className='text-muted-foreground' icon={FolderKanban} size='sm' />
						<Select.Value />
					</span>
				</Select.Trigger>
				<Select.Content>
					<Select.ItemList>
						<Select.Item value={NONE}>{t('notes.meta.project.none')}</Select.Item>
						{(projects.data ?? []).map(project => (
							<Select.Item key={project.id} value={project.id}>
								{project.title}
							</Select.Item>
						))}
					</Select.ItemList>
				</Select.Content>
			</Select.Root>
			<div className='flex min-w-56 flex-1'>
				<Combobox
					className='h-full'
					multiple
					onCreate={name => createTag.mutate({ name }, { onSuccess: tag => onChange({ ...value, tagIds: [...value.tagIds, tag.id] }) })}
					onValueChange={tagIds => onChange({ ...value, tagIds })}
					value={value.tagIds}
				>
					<Combobox.Input aria-label={t('notes.meta.tags.label')} containerClassName={cn(listStyles.pillInput, 'flex-1')} placeholder={t('notes.meta.tags.placeholder')} />
					<Combobox.Content createLabel={name => t('notes.meta.tags.create', { name })} emptyMessage={t('notes.meta.tags.empty')}>
						{(tags.data ?? []).map(tag => (
							<Combobox.Item key={tag.id} label={tag.name} value={tag.id}>
								{tag.name}
							</Combobox.Item>
						))}
					</Combobox.Content>
				</Combobox>
			</div>
			<div className='flex min-w-56 flex-1'>
				<LinkedTasks onChange={taskIds => onChange({ ...value, taskIds })} value={value.taskIds} />
			</div>
		</div>
	);
}
