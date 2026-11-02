import { ArrowRight, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/actions-controls/button/button';
import { Input } from '~/components/ui/forms-inputs/input/input';
import { Kbd } from '~/components/ui/foundations/kbd/kbd';
import { useTranslate } from '~/hooks/use-translate';
import { shortcutKeys } from '../../shared/shortcut-keys';
import { listStyles } from '../../shared/styles';
import { useCapture } from '../api';

const CONTENT_MAX = 2000;

/** One-line capture: Enter or the arrow adds the text to the inbox as a `quick` item. */
export function QuickCapture() {
	const t = useTranslate();
	const capture = useCapture();
	const [value, setValue] = useState('');
	const content = value.trim();

	const submit = () => {
		if (!content || capture.isPending) return;
		capture.mutate(content, { onSuccess: () => setValue('') });
	};

	return (
		<form
			className='w-full'
			onSubmit={event => {
				event.preventDefault();
				submit();
			}}
		>
			<Input className={`${listStyles.card} px-5 py-4`}>
				<Input.Icon className='text-foreground' icon={Sparkles} />
				<Input.Field
					aria-label={t('inbox.capture.label')}
					autoComplete='off'
					maxLength={CONTENT_MAX}
					onChange={event => setValue(event.target.value)}
					onKeyDown={event => {
						if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
							event.preventDefault();
							submit();
						}
					}}
					placeholder={t('inbox.capture.placeholder')}
					value={value}
				/>
				<Kbd.Group className='hidden sm:inline-flex'>
					{shortcutKeys('mod+enter').map(key => (
						<Kbd key={key}>{key}</Kbd>
					))}
				</Kbd.Group>
				<Button aria-label={t('inbox.capture.submit')} className='size-9 rounded-full p-0' disabled={!content} loading={capture.isPending} lang={{ loadingText: '' }} size='icon' type='submit'>
					<Button.Icon icon={ArrowRight} />
				</Button>
			</Input>
		</form>
	);
}
