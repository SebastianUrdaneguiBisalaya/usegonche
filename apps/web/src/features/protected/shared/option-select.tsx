import type { LucideIcon } from 'lucide-react';
import { Select } from '~/components/ui/forms-inputs/select/select';
import { Icon } from '~/components/ui/foundations/icon/icon';
import { cn } from '~/components/ui/utils/tailwind/cn';
import { listStyles } from './styles';

interface OptionSelectProps<T extends string> {
	icon?: LucideIcon;
	label: string;
	onChange: (value: T) => void;
	options: readonly { label: string; value: T }[];
	value: T;
}

/** A pill dropdown over a fixed list of options (sort order, due filter, ...). */
export function OptionSelect<T extends string>({ icon, label, onChange, options, value }: OptionSelectProps<T>) {
	return (
		<Select.Root onChange={next => onChange(next as T)} value={value}>
			<Select.Trigger aria-label={label} className={cn(listStyles.pillTrigger, 'h-auto min-w-40')}>
				<span className='flex min-w-0 items-center gap-2'>
					{icon && <Icon aria-hidden className='text-muted-foreground' icon={icon} size='sm' />}
					<Select.Value />
				</span>
			</Select.Trigger>
			<Select.Content>
				<Select.ItemList>
					{options.map(option => (
						<Select.Item key={option.value} value={option.value}>
							{option.label}
						</Select.Item>
					))}
				</Select.ItemList>
			</Select.Content>
		</Select.Root>
	);
}
