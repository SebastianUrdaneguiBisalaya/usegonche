import { Check, Save, Zap } from 'lucide-react';
import { Button } from '~/components/ui/actions-controls/button/button';
import { Typography } from '~/components/ui/foundations/typography/typography';
import { cn } from '~/components/ui/utils/tailwind/cn';
import { useTranslate } from '~/hooks/use-translate';
import { listStyles } from '../../shared/styles';

interface ActionsCardProps {
	closed: boolean;
	closing: boolean;
	onClose: () => void;
	onDraft: () => void;
	saving: boolean;
}

/** Close the review (snapshots the figures and locks it) or just keep the text as a draft. */
export function ActionsCard({ closed, closing, onClose, onDraft, saving }: ActionsCardProps) {
	const t = useTranslate();
	return (
		<section className={cn(listStyles.card, 'flex flex-col gap-4 p-5')}>
			<span className='flex items-center gap-3 text-base font-semibold'>
				<Zap aria-hidden className='size-5 text-muted-foreground' />
				{t('reflect.actions.title')}
			</span>
			{closed ? (
				<Typography.Span className='flex items-center gap-2 text-sm text-muted-foreground'>
					<Check aria-hidden className='size-4 text-success' />
					{t('reflect.actions.closed')}
				</Typography.Span>
			) : (
				<>
					<Button className='w-full justify-center rounded-full py-3' disabled={closing} loading={closing} onClick={onClose}>
						<Button.Icon icon={Check} />
						<Button.Text>{t('reflect.actions.close')}</Button.Text>
					</Button>
					<div className='flex items-center gap-3 text-xs text-muted-foreground'>
						<span className='h-px flex-1 bg-border' />
						{t('reflect.actions.or')}
						<span className='h-px flex-1 bg-border' />
					</div>
					<Button className='w-full justify-center rounded-full py-3' disabled={saving} loading={saving} onClick={onDraft} variant='secondary'>
						<Button.Icon icon={Save} />
						<Button.Text>{t('reflect.actions.draft')}</Button.Text>
					</Button>
				</>
			)}
		</section>
	);
}
