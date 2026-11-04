import { Skeleton } from '~/components/ui/foundations/skeleton/skeleton';
import { cn } from '~/components/ui/utils/tailwind/cn';

interface FilterChipProps {
	active: boolean;
	/** Counter next to the label (a pulsing placeholder until it arrives); leave it out for a chip without one. */
	count?: number | undefined;
	hasCount?: boolean;
	icon?: React.ReactNode;
	label: string;
	onClick: () => void;
	tone?: 'danger';
}

/** A toggle chip of a list page with its optional counter. */
export function FilterChip({ active, count, hasCount = true, icon, label, onClick, tone }: FilterChipProps) {
	return (
		<button
			aria-pressed={active}
			className={cn(
				'flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
				active ? 'border-border-strong bg-foreground/6' : 'border-border hover:bg-foreground/4',
				tone === 'danger' && active ? 'text-destructive' : ''
			)}
			onClick={onClick}
			type='button'
		>
			{icon}
			{label}
			{!hasCount ? null : count === undefined ? (
				<Skeleton className='gap-0'>
					<Skeleton.Item className='h-4 w-6 rounded-full' />
				</Skeleton>
			) : (
				<span className={cn('rounded-full px-2 py-0.5 text-xs tabular-nums', tone === 'danger' && count > 0 ? 'bg-destructive/10 text-destructive' : 'bg-muted')}>{count}</span>
			)}
		</button>
	);
}
