import { Tag, Target } from 'lucide-react';
import { Select } from '~/components/ui/forms-inputs/select/select';
import { Icon } from '~/components/ui/foundations/icon/icon';
import { useTranslate } from '~/hooks/use-translate';
import { listStyles } from '../../shared/styles';

const ALL = '__all';

interface FilterSelectProps {
	allLabel: string;
	label: string;
	onChange: (id: string) => void;
	options: readonly { id: string; name: string }[];
	/** Selected id, or empty for "all". */
	value: string;
}

function FilterSelect({ allLabel, icon, label, onChange, options, value }: FilterSelectProps & { icon: typeof Target }) {
	return (
		<Select.Root onChange={next => onChange(next === ALL ? '' : next)} value={value || ALL}>
			<Select.Trigger aria-label={label} className={`${listStyles.pillTrigger} min-w-44`}>
				<span className='flex min-w-0 items-center gap-2'>
					<Icon aria-hidden className='text-muted-foreground' icon={icon} size='sm' />
					<Select.Value />
				</span>
			</Select.Trigger>
			<Select.Content>
				<Select.ItemList>
					<Select.Item value={ALL}>{allLabel}</Select.Item>
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

interface IdFilterProps {
	onChange: (id: string) => void;
	options: readonly { id: string; name: string }[];
	value: string;
}

/** "All goals" / one goal (`goalId`). */
export function GoalFilter({ onChange, options, value }: IdFilterProps) {
	const t = useTranslate();
	return <FilterSelect allLabel={t('projects.filters.goal.all')} icon={Target} label={t('projects.filters.goal.label')} onChange={onChange} options={options} value={value} />;
}

/** "All tags" / one tag (`tagId`). */
export function TagFilter({ onChange, options, value }: IdFilterProps) {
	const t = useTranslate();
	return <FilterSelect allLabel={t('projects.filters.tag.all')} icon={Tag} label={t('projects.filters.tag.label')} onChange={onChange} options={options} value={value} />;
}

interface PageSelectProps {
	onChange: (page: number) => void;
	page: number;
	pageCount: number;
}

/** "Page: 3" jump list, next to the pagination at the bottom. */
export function PageSelect({ onChange, page, pageCount }: PageSelectProps) {
	const t = useTranslate();
	return (
		<Select.Root onChange={next => onChange(Number(next))} value={String(page)}>
			<Select.Trigger aria-label={t('projects.filters.page.label')} className={`${listStyles.pillTrigger} min-w-28`}>
				<span className='text-sm'>{t('projects.filters.page.value', { page })}</span>
			</Select.Trigger>
			<Select.Content>
				<Select.ItemList>
					{Array.from({ length: pageCount }, (_, index) => index + 1).map(number => (
						<Select.Item key={number} value={String(number)}>
							{number}
						</Select.Item>
					))}
				</Select.ItemList>
			</Select.Content>
		</Select.Root>
	);
}
