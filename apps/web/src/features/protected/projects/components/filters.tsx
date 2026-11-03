import { Tag, Target } from 'lucide-react';
import { useTranslate } from '~/hooks/use-translate';
import { IdSelect } from '../../shared/id-select';

interface IdFilterProps {
	onChange: (id: string) => void;
	options: readonly { id: string; name: string }[];
	value: string;
}

/** "All goals" / one goal (`goalId`). */
export function GoalFilter({ onChange, options, value }: IdFilterProps) {
	const t = useTranslate();
	return <IdSelect className='min-w-44' allLabel={t('projects.filters.goal.all')} icon={Target} label={t('projects.filters.goal.label')} onChange={onChange} options={options} value={value} />;
}

/** "All tags" / one tag (`tagId`). */
export function TagFilter({ onChange, options, value }: IdFilterProps) {
	const t = useTranslate();
	return <IdSelect className='min-w-44' allLabel={t('projects.filters.tag.all')} icon={Tag} label={t('projects.filters.tag.label')} onChange={onChange} options={options} value={value} />;
}
