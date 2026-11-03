import { Sparkles } from 'lucide-react';
import { Kbd } from '~/components/ui/foundations/kbd/kbd';
import { useTranslate } from '~/hooks/use-translate';
import { QuickAdd } from '../../shared/quick-add';
import { shortcutKeys } from '../../shared/shortcut-keys';
import { useCapture } from '../api';

const CONTENT_MAX = 2000;

/** One-line capture: Enter or the arrow adds the text to the inbox as a `quick` item. */
export function QuickCapture() {
	const t = useTranslate();
	const capture = useCapture();

	return (
		<QuickAdd
			hint={
				<Kbd.Group className='hidden sm:inline-flex'>
					{shortcutKeys('mod+enter').map(key => (
						<Kbd key={key}>{key}</Kbd>
					))}
				</Kbd.Group>
			}
			icon={Sparkles}
			label={t('inbox.capture.label')}
			maxLength={CONTENT_MAX}
			onSubmit={text => capture.mutateAsync(text)}
			pending={capture.isPending}
			placeholder={t('inbox.capture.placeholder')}
			submitLabel={t('inbox.capture.submit')}
		/>
	);
}
