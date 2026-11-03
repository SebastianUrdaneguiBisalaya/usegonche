import { Select } from '~/components/ui/forms-inputs/select/select';
import { useTranslate } from '~/hooks/use-translate';
import { listStyles } from '../../shared/styles';
import { RANGE_PRESETS, type RangePreset } from '../range';

interface RangeSelectProps {
	children?: React.ReactNode;
	className?: string;
	label: string;
	onChange: (preset: RangePreset) => void;
	value: RangePreset;
}

/** "Last 30 days": the date-range control every card of the dashboard carries. */
export function RangeSelect({ children, className = '', label, onChange, value }: RangeSelectProps) {
	const t = useTranslate();
	return (
		<Select.Root onChange={next => onChange(next as RangePreset)} value={value}>
			<Select.Trigger aria-label={label} className={`${listStyles.pillTrigger} !py-1.5 text-sm ${className}`}>
				{children}
				<Select.Value />
			</Select.Trigger>
			<Select.Content>
				<Select.ItemList>
					{RANGE_PRESETS.map(preset => (
						<Select.Item key={preset} value={preset}>
							{t('analytics.range.last', { count: Number(preset) })}
						</Select.Item>
					))}
				</Select.ItemList>
			</Select.Content>
		</Select.Root>
	);
}
