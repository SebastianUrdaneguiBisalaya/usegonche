/** The "glass" look of the web app (`apps/web` auth card, list panels), shared by every landing section. */
export const glass = {
	/** Dark frosted surface: hairline white border, soft top-lit gradient, deep shadow with an inner highlight, strong blur. Pair it with a radius. */
	surface: 'border border-white/10 bg-transparent bg-linear-to-b from-white/[0.07] to-white/2 shadow-[0_24px_80px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl',
	/** Lighter panel for cards inside a section (app mockups, feature cards). */
	card: 'rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md',
	/** Floating panel that sits over other content (hero mockup window and cards): a darker tinted base so what is behind it stays blurred, not readable. Pair it with a radius. */
	floating: 'border border-white/10 bg-neutral-950/70 bg-linear-to-b from-white/[0.08] to-white/[0.02] shadow-[0_24px_60px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl',
	/** Outlined transparent pill (secondary CTA, e.g. "Get started free"). */
	pill: 'rounded-full border border-white/20 bg-transparent hover:bg-white/5',
} as const;
