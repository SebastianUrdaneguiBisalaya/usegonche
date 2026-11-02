import { Select } from '~/components/ui/forms-inputs/select/select';
import { useTranslate } from '~/hooks/use-translate';
import { type InboxRange, inboxRanges } from '../search-params';
import { inboxStyles } from '../styles';

interface RangeSelectProps {
	onChange: (range: InboxRange) => void;
	value: InboxRange;
}

/** "All time" / last 24 hours / 7 days / 30 days: a rolling window over the capture date. */
export function RangeSelect({ onChange, value }: RangeSelectProps) {
	const t = useTranslate();

	return (
		<Select.Root onChange={next => onChange(next as InboxRange)} value={value}>
			<Select.Trigger aria-label={t('inbox.range.label')} className={`${inboxStyles.pillTrigger} min-w-40`}>
				<Select.Value />
			</Select.Trigger>
			<Select.Content>
				<Select.ItemList>
					{inboxRanges.map(range => (
						<Select.Item key={range} value={range}>
							{t(`inbox.range.${range}`)}
						</Select.Item>
					))}
				</Select.ItemList>
			</Select.Content>
		</Select.Root>
	);
}
