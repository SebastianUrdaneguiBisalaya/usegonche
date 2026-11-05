import type { LucideIcon } from 'lucide-react';
import { Select } from '~/components/ui/forms-inputs/select/select';
import { Icon } from '~/components/ui/foundations/icon/icon';
import { cn } from '~/components/ui/utils/tailwind/cn';
import { listStyles } from './styles';

const ALL = '__all';

export interface IdSelectProps {
	allLabel: string;
	className?: string;
	/** Extra option after "all" (e.g. "No project"), as `[value, label]`. */
	extra?: readonly [string, string];
	icon: LucideIcon;
	label: string;
	onChange: (id: string) => void;
	options: readonly { id: string; name: string }[];
	/** Selected id, or empty for "all". */
	value: string;
}

/** A pill select that filters a list by one id ("All projects" / one project): the empty value means "all". */
export function IdSelect({ allLabel, className = 'min-w-40', extra, icon, label, onChange, options, value }: IdSelectProps) {
	return (
		<Select.Root onChange={next => onChange(next === ALL ? '' : next)} value={value || ALL}>
			<Select.Trigger aria-label={label} className={cn(listStyles.control, className)}>
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
