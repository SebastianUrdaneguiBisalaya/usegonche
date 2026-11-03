import { ArrowDown, ArrowUp } from 'lucide-react';

/** "↑ +8%" in green, "↓ -3%" in red; nothing when there is no change to show. `unit` is `%` or percentage points. */
export function Delta({ className = '', inverted = false, value }: { className?: string; inverted?: boolean; value: number | null }) {
	if (value === null || value === 0) return null;
	const up = value > 0;
	const good = inverted ? !up : up;
	const Arrow = up ? ArrowUp : ArrowDown;
	return (
		<span className={`inline-flex items-center gap-0.5 text-sm font-medium tabular-nums ${good ? 'text-success' : 'text-destructive'} ${className}`}>
			<Arrow aria-hidden className='size-3.5' />
			{up ? '+' : ''}
			{value}%
		</span>
	);
}
