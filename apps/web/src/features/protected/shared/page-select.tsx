import { Select } from '~/components/ui/forms-inputs/select/select';
import { listStyles } from './styles';

interface PageSelectProps {
	/** Accessible name of the selector. */
	label: string;
	onChange: (page: number) => void;
	page: number;
	pageCount: number;
	/** Text of the trigger ("Page: 3"). */
	valueLabel: string;
}

/** "Page: 3" jump list of a list page. */
export function PageSelect({ label, onChange, page, pageCount, valueLabel }: PageSelectProps) {
	return (
		<Select.Root onChange={next => onChange(Number(next))} value={String(page)}>
			<Select.Trigger aria-label={label} className={`${listStyles.pillTrigger} min-w-28`}>
				<span className='text-sm'>{valueLabel}</span>
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
