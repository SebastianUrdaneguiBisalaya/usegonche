import { ArrowRight, Lightbulb } from 'lucide-react';
import { Button } from '~/components/ui/actions-controls/button/button';
import { Pill } from '~/components/ui/data-display/pill/pill';
import { Skeleton } from '~/components/ui/foundations/skeleton/skeleton';
import { Typography } from '~/components/ui/foundations/typography/typography';
import { useTranslate } from '~/hooks/use-translate';
import { listStyles } from '../../shared/styles';
import { useNextTask } from '../api';

interface NextTaskProps {
	onOpen: (taskId: string) => void;
}

/**
 * "Next best task": the top suggestion of `GET /suggestions/next` with the reasons it was picked (overdue, due soon, high priority...).
 * Read-only: it only opens the task, it never changes anything.
 */
export function NextTask({ onOpen }: NextTaskProps) {
	const t = useTranslate();
	const next = useNextTask();

	if (next.isPending) {
		return (
			<Skeleton className={`${listStyles.card} gap-2 p-4`}>
				<Skeleton.Item className='h-4 w-40' />
				<Skeleton.Item className='h-5 w-64' />
			</Skeleton>
		);
	}
	// A failed suggestion is not worth a banner: the page works without it.
	const suggestion = next.data?.suggestions[0];
	if (next.isError || !suggestion) return null;

	return (
		<div className={`${listStyles.card} flex flex-wrap items-center justify-between gap-3 p-4`}>
			<div className='flex min-w-0 flex-col gap-2'>
				<span className='flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground'>
					<Lightbulb aria-hidden className='size-4' />
					{t('tasks.next.title')}
				</span>
				<Typography.Span className='truncate text-sm font-medium' title={suggestion.task.title}>
					{suggestion.task.title}
				</Typography.Span>
				<div className='flex flex-wrap gap-1.5'>
					{suggestion.reasons.map(reason => (
						<Pill key={reason.code} variant='outline'>
							<Pill.Text>{t(`tasks.next.reason.${reason.code}`, { value: reason.value ?? 0 })}</Pill.Text>
						</Pill>
					))}
				</div>
			</div>
			<Button className='rounded-full' onClick={() => onOpen(suggestion.task.id)} variant='secondary'>
				<Button.Text>{t('tasks.next.open')}</Button.Text>
				<Button.Icon icon={ArrowRight} />
			</Button>
		</div>
	);
}
