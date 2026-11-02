/** Shared class names that give the auth forms their dark "glass" look. */
export const authStyles = {
	/** Pill input: icon + field inside a rounded-full outlined container. */
	input: 'rounded-full border-white/15 bg-white/[0.03] px-4 py-3 focus-within:border-white/35',
	/** Primary action: soft grey gradient pill with white text. */
	primary: 'w-full rounded-full border border-white/10 bg-transparent bg-linear-to-b from-[#6e6e6e] to-[#4a4a4a] py-3 hover:opacity-90',
	primaryText: 'text-white',
	/** Secondary action: outlined transparent pill (e.g. Continue with Google). */
	secondary: 'w-full rounded-full border-white/15 bg-transparent py-3 hover:bg-white/5',
	secondaryText: 'text-xs',
	separator: 'text-xs text-foreground-secondary [&>span:not(:nth-child(2))]:bg-white/10',
	subtitle: 'text-sm text-foreground-secondary',
	title: 'border-none pb-0 text-3xl font-light tracking-tight',
} as const;
