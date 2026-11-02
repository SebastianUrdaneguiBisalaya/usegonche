import type { LucideIcon } from 'lucide-react';
import { Tabs } from '~/components/ui/data-display/tabs/tabs';
import { Skeleton } from '~/components/ui/foundations/skeleton/skeleton';

export interface StatusTab<T extends string> {
	/** Leading icon of the tab. */
	icon?: LucideIcon;
	/** Classes of the icon (e.g. its color). */
	iconClassName?: string;
	label: string;
	value: T;
}

interface StatusTabsProps<T extends string> {
	/** Accessible name of the tab list. */
	ariaLabel: string;
	/** Items per tab; `undefined` while loading (a pulsing placeholder shows instead). */
	counts: Record<T, number> | undefined;
	onChange: (value: T) => void;
	tabs: readonly StatusTab<T>[];
	value: T;
}

/** The status tabs of a list page, each with its counter (a pulsing placeholder until the counts arrive). */
export function StatusTabs<T extends string>({ ariaLabel, counts, onChange, tabs, value }: StatusTabsProps<T>) {
	return (
		<Tabs defaultValue={value} onValueChange={next => onChange(next as T)} value={value}>
			<Tabs.List aria-label={ariaLabel} className='gap-2 bg-transparent p-0'>
				{tabs.map(tab => (
					<Tabs.Trigger
						className={`rounded-full border px-4 py-2 ${tab.value === value ? 'border-border-strong bg-foreground/[0.06] shadow-none' : 'border-border'}`}
						key={tab.value}
						value={tab.value}
					>
						{tab.icon && <Tabs.TriggerIcon className={tab.iconClassName} icon={tab.icon} />}
						<Tabs.TriggerTitle className='text-sm'>{tab.label}</Tabs.TriggerTitle>
						{counts ? (
							<span className='rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums'>{counts[tab.value]}</span>
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
