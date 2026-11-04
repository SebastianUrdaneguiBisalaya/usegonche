import { Palette, X } from 'lucide-react';
import { Button } from '~/components/ui/actions-controls/button/button';
import { ColorPicker } from '~/components/ui/data-display/color-picker/color-picker';
import { cn } from '~/components/ui/utils/tailwind/cn';
import { useTranslate } from '~/hooks/use-translate';
import { listStyles } from '../../shared/styles';

/** Where the picker starts when the user asks to set a color for a tag that has none. A tag is never given a color on its own. */
const PICKER_START = '#6b7280';

interface TagColorFieldProps {
	/** `#rrggbb`, or empty when the tag has no color. */
	onChange: (color: string) => void;
	value: string;
}

/** The color of a tag: a "Set color" button while it has none, then the color picker with a button to remove it again. */
export function TagColorField({ onChange, value }: TagColorFieldProps) {
	const t = useTranslate();

	if (!value) {
		return (
			<Button className={cn(listStyles.pillTrigger, 'shrink-0')} onClick={() => onChange(PICKER_START)} type='button' variant='secondary'>
				<Button.Icon icon={Palette} />
				<Button.Text className='text-xs'>{t('tags.color.set')}</Button.Text>
			</Button>
		);
	}

	return (
		<div className='flex shrink-0 items-center gap-1'>
			<ColorPicker onValueChange={onChange} value={value}>
				<ColorPicker.Trigger aria-label={t('tags.color.choose')} className='rounded-full' />
				<ColorPicker.Content aria-label={t('tags.color.picker')}>
					<ColorPicker.Gradient />
					<div className='flex items-center gap-2'>
						<ColorPicker.HexField aria-label={t('tags.color.hex')} />
						<ColorPicker.EyeDropper aria-label={t('tags.color.eyedropper')} />
					</div>
				</ColorPicker.Content>
			</ColorPicker>
			<Button aria-label={t('tags.color.remove')} className='size-8 rounded-full p-0' onClick={() => onChange('')} size='icon' title={t('tags.color.remove')} type='button' variant='ghost'>
				<Button.Icon icon={X} />
			</Button>
		</div>
	);
}
