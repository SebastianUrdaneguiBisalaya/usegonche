import { Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Input } from '~/components/ui/forms-inputs/input/input';
import { Kbd } from '~/components/ui/foundations/kbd/kbd';
import { listStyles } from './styles';

interface ListSearchProps {
	/** Accessible name of the "clear" button. */
	clearLabel: string;
	/** Accessible name of the field. */
	label: string;
	onChange: (q: string) => void;
	placeholder: string;
	/** The `?q=` of the URL. */
	value: string;
}

/** Search box of a list page. Typing is debounced into the URL; `/` focuses it. */
export function ListSearch({ clearLabel, label, onChange, placeholder, value }: ListSearchProps) {
	const ref = useRef<HTMLInputElement>(null);
	const [text, setText] = useState(value);
	const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

	// URL -> box (back button, cleared elsewhere).
	useEffect(() => setText(value), [value]);
	useEffect(() => () => clearTimeout(timer.current), []);

	/** Box -> URL, once typing pauses (one request per pause, not per keystroke). */
	const type = (next: string) => {
		setText(next);
		clearTimeout(timer.current);
		timer.current = setTimeout(() => onChange(next.trim()), 300);
	};

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null;
			if (event.key !== '/' || event.metaKey || event.ctrlKey || target?.closest('input, textarea, [contenteditable]')) return;
			event.preventDefault();
			ref.current?.focus();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, []);

	return (
		<Input className={`${listStyles.pillInput} w-full sm:w-72`}>
			<Input.Icon icon={Search} />
			<Input.Field aria-label={label} autoComplete='off' onChange={event => type(event.target.value)} placeholder={placeholder} ref={ref} value={text} />
			{text ? (
				<button
					aria-label={clearLabel}
					className='flex cursor-pointer text-muted-foreground hover:text-foreground'
					onClick={() => {
						clearTimeout(timer.current);
						setText('');
						onChange('');
					}}
					type='button'
				>
					<X aria-hidden className='size-4' />
				</button>
			) : (
				<Kbd className='hidden sm:inline-flex'>/</Kbd>
			)}
		</Input>
	);
}
