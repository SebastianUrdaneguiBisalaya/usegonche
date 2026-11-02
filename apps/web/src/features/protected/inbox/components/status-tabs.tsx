import { Tabs } from '~/components/ui/data-display/tabs/tabs';
import { Skeleton } from '~/components/ui/foundations/skeleton/skeleton';
import { useTranslate } from '~/hooks/use-translate';
import { type InboxStatus, inboxStatuses } from '../search-params';

interface StatusTabsProps {
	/** Items per status for the active time range; `undefined` while loading. */
	counts: Record<InboxStatus, number> | undefined;
	onChange: (status: InboxStatus) => void;
	value: InboxStatus;
}

/** Pending / Archived / Discarded / Converted, each with its counter (a pulsing placeholder until the counts arrive). */
export function StatusTabs({ counts, onChange, value }: StatusTabsProps) {
	const t = useTranslate();

	return (
		<Tabs onValueChange={next => onChange(next as InboxStatus)} value={value} defaultValue={value}>
			<Tabs.List aria-label={t('inbox.tabs.label')} className='gap-2 bg-transparent p-0'>
				{inboxStatuses.map(status => (
					<Tabs.Trigger
						className={`rounded-full border px-4 py-2 ${status === value ? 'border-border-strong bg-foreground/[0.06] shadow-none' : 'border-border'}`}
						key={status}
						value={status}
					>
						<Tabs.TriggerTitle className='text-sm'>{t(`inbox.tabs.${status}`)}</Tabs.TriggerTitle>
						{counts ? (
							<span className='rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums'>{counts[status]}</span>
						) : (
							<Skeleton className='gap-0'>
								<Skeleton.Item className='h-4 w-6 rounded-full' />
							</Skeleton>
						)}
					</Tabs.Trigger>
				))}
			</Tabs.List>
		</Tabs>
	);
}
