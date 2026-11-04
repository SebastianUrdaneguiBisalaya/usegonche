/** Shared class names that give the list pages (Inbox, Projects, ...) the same soft "glass" look as the auth screens, on the theme tokens (so it works in light and dark). */
export const listStyles = {
	/** Glass panel: rounded, outlined, translucent and blurred (Brain Dump, the tables, the cards). Use it for any container that should look like glass. */
	card: 'rounded-2xl border border-border bg-foreground/[0.03] backdrop-blur-md',
	/** Text field inside a form (modal, drawer): rounded, outlined, translucent. */
	field: 'rounded-xl border-border bg-foreground/[0.03] px-4 py-2.5 focus-within:border-border-strong',
	/** Round icon-only action. */
	iconButton: 'size-9 rounded-full p-0 text-muted-foreground hover:text-foreground',
	/** Pill input: icon + field inside a rounded-full outlined container. */
	pillInput: 'rounded-full border-border bg-foreground/[0.03] px-4 py-2.5 focus-within:border-border-strong',
	/** Pill trigger / button. */
	pillTrigger: 'rounded-full border-border bg-foreground/[0.03] px-4 py-2.5',
} as const;
