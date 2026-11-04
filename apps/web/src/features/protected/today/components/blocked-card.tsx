import { ArrowRight, OctagonAlert } from 'lucide-react';
import { Link } from 'react-router';
import { Typography } from '~/components/ui/foundations/typography/typography';
import { cn } from '~/components/ui/utils/tailwind/cn';
import { useTranslate } from '~/hooks/use-translate';
import { listStyles } from '../../shared/styles';
import { useBlockedTasks } from '../api';

/** Open tasks that cannot move (`GET /tasks?blocked=true`). Informational: the list lives in Tasks. Hidden when nothing is blocked. */
export function BlockedCard() {
	const t = useTranslate();
	const blocked = useBlockedTasks();
	const tasks = blocked.data?.data ?? [];
	const total = blocked.data?.meta.total ?? 0;
	if (blocked.isError || total === 0) return null;

	return (
		<section className={cn(listStyles.card, 'flex flex-col gap-3 p-5')}>
			<div className='flex items-center justify-between gap-3'>
				<span className='flex items-center gap-2 text-base font-semibold'>
					<OctagonAlert aria-hidden className='size-5 text-destructive' />
					{t('today.blocked.title')}
				</span>
				<Link className='flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground' to='/tasks?blocked=true'>
					{t(total === 1 ? 'today.blocked.count_one' : 'today.blocked.count_other', { count: total })}
					<ArrowRight aria-hidden className='size-3' />
				</Link>
			</div>
			<ul className='flex flex-col gap-2'>
				{tasks.map(task => (
					<li key={task.id}>
						<Typography.Span className='block truncate text-sm' title={task.title}>
							{task.title}
						</Typography.Span>
					</li>
				))}
			</ul>
		</section>
	);
}
