import { ArrowRight, type LucideIcon } from 'lucide-react';
import { type ReactNode, type Ref, useState } from 'react';
import { Button } from '~/components/ui/actions-controls/button/button';
import { Input } from '~/components/ui/forms-inputs/input/input';
import { listStyles } from './styles';

interface QuickAddProps {
	/** Shown at the end of the field, before the button (e.g. a shortcut hint). */
	hint?: ReactNode;
	icon: LucideIcon;
	/** Ref of the text field, so the page can focus it. */
	inputRef?: Ref<HTMLInputElement>;
	/** Accessible name of the field. */
	label: string;
	maxLength: number;
	/** Called with the trimmed text when it is not empty; resolve to clear the field, reject to keep the text. */
	onSubmit: (text: string) => Promise<unknown> | undefined;
	pending: boolean;
	placeholder: string;
	/** Icon of the submit button. */
	submitIcon?: LucideIcon;
	/** Accessible name of the submit button. */
	submitLabel: string;
}

/** One-line add bar of a list page: Enter or the round button submits the text. The field is cleared once `onSubmit` resolves. */
export function QuickAdd({ hint, icon, inputRef, label, maxLength, onSubmit, pending, placeholder, submitIcon = ArrowRight, submitLabel }: QuickAddProps) {
	const [value, setValue] = useState('');
	const text = value.trim();

	const submit = async () => {
		if (!text || pending) return;
		try {
			await onSubmit(text);
			setValue('');
		} catch {
			// The page reports the error (toast); the text stays so it can be fixed and sent again.
		}
	};

	return (
		<form
			className='w-full'
			onSubmit={event => {
				event.preventDefault();
				void submit();
			}}
		>
			<Input className={`${listStyles.card} px-5 py-4`}>
				<Input.Icon className='text-foreground' icon={icon} />
				<Input.Field
					aria-label={label}
					autoComplete='off'
					maxLength={maxLength}
					onChange={event => setValue(event.target.value)}
					onKeyDown={event => {
						if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
							event.preventDefault();
							void submit();
						}
					}}
					placeholder={placeholder}
					ref={inputRef}
					value={value}
				/>
				{hint}
				<Button aria-label={submitLabel} className='size-9 rounded-full p-0' disabled={!text} loading={pending} lang={{ loadingText: '' }} size='icon' type='submit'>
					<Button.Icon icon={submitIcon} />
				</Button>
			</Input>
		</form>
	);
}
