import bgDark from '~/assets/bg-usegonche-dark.png';
import bgLight from '~/assets/bg-usegonche-light.png';
import type { ThemePreference } from '~/components/ui/actions-controls/switch-theme/switch-theme';
import { cn } from '~/components/ui/utils/tailwind/cn';

interface ThemeChoiceProps {
	description: string;
	label: string;
	onSelect: () => void;
	selected: boolean;
	value: ThemePreference;
}

/** White dots on the dark artwork (also the dark half of "system"), dark dots on the light one. */
const Dots = ({ light }: { light: boolean }) => (
	<span aria-hidden className='absolute top-2 left-2 flex gap-1'>
		<span className={cn('size-1 rounded-full', light ? 'bg-black/60' : 'bg-white/60')} />
		<span className={cn('size-1 rounded-full', light ? 'bg-black/40' : 'bg-white/40')} />
		<span className={cn('size-1 rounded-full', light ? 'bg-black/30' : 'bg-white/30')} />
	</span>
);

/** Previews with the app artwork: the dark image, the light image, and both split in half for "system". */
function Preview({ value }: { value: ThemePreference }) {
	return (
		<span aria-hidden className='relative flex h-24 w-full max-w-44 overflow-hidden rounded-xl border border-white/10'>
			{value === 'system' ? (
				<>
					<span className='relative w-1/2 overflow-hidden'>
						<img alt='' className='absolute inset-0 h-full w-[200%] max-w-none object-cover' src={bgDark} />
					</span>
					<span className='relative w-1/2 overflow-hidden'>
						<img alt='' className='absolute inset-0 left-auto right-0 h-full w-[200%] max-w-none object-cover' src={bgLight} />
					</span>
				</>
			) : (
				<img alt='' className='size-full object-cover' src={value === 'dark' ? bgDark : bgLight} />
			)}
			<Dots light={value === 'light'} />
		</span>
	);
}

/** One theme option of the onboarding: a radio card with a preview, its name and a short description. */
export function ThemeChoice({ description, label, onSelect, selected, value }: ThemeChoiceProps) {
	return (
		<button
			aria-checked={selected}
			className={cn(
				'relative flex cursor-pointer flex-col items-center gap-3 rounded-2xl border px-4 pt-8 pb-5 text-center transition-colors',
				selected ? 'border-white/60 bg-white/[0.07]' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.05]'
			)}
			onClick={onSelect}
			role='radio'
			type='button'
		>
			<span aria-hidden className={cn('absolute top-3 right-3 flex size-5 items-center justify-center rounded-full border', selected ? 'border-transparent bg-white' : 'border-white/30')}>
				{selected && <span className='size-2 rounded-full bg-black' />}
			</span>
			<Preview value={value} />
			<span className='text-sm font-medium'>{label}</span>
			<span className='text-xs text-foreground-secondary'>{description}</span>
		</button>
	);
}
