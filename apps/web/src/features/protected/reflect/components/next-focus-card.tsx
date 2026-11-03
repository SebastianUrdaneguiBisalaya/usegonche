import { Target } from 'lucide-react';
import { Button } from '~/components/ui/actions-controls/button/button';
import { Typography } from '~/components/ui/foundations/typography/typography';
import { useTranslate } from '~/hooks/use-translate';
import { listStyles } from '../../shared/styles';

const FOCUS_MAX = 500;

interface NextFocusCardProps {
	onChange: (value: string) => void;
	onSave: () => void;
	pending: boolean;
	readOnly: boolean;
	/** What is saved in the review now, to know whether there is something to save. */
	saved: string;
	value: string;
}

/** What to focus on in the next period (`nextFocus` of the review). */
export function NextFocusCard({ onChange, onSave, pending, readOnly, saved, value }: NextFocusCardProps) {
	const t = useTranslate();
	return (
		<section className={`${listStyles.card} flex flex-col gap-4 p-5`}>
			<div className='flex flex-col gap-1'>
				<span className='flex items-center gap-3 text-lg font-semibold'>
					<Target aria-hidden className='size-5 text-muted-foreground' />
					{t('reflect.focus.title')}
				</span>
				<Typography.Span className='text-sm text-muted-foreground'>{t('reflect.focus.subtitle')}</Typography.Span>
			</div>
			<form
				className='flex items-center gap-2 rounded-xl border border-border bg-foreground/[0.03] py-1.5 pr-1.5 pl-4 focus-within:border-border-strong'
				onSubmit={event => {
					event.preventDefault();
					onSave();
				}}
			>
				<input
					aria-label={t('reflect.focus.title')}
					className='min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60'
					disabled={readOnly}
					maxLength={FOCUS_MAX}
					onChange={event => onChange(event.target.value)}
					placeholder={t('reflect.focus.placeholder')}
					value={value}
				/>
				{!readOnly && (
					<Button className='rounded-full' disabled={value.trim() === saved.trim() || pending} loading={pending} type='submit' variant='secondary'>
						<Button.Text>{t('reflect.focus.save')}</Button.Text>
					</Button>
				)}
			</form>
		</section>
	);
}
