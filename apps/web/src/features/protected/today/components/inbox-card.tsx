import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';
import { Pill } from '~/components/ui/data-display/pill/pill';
import { Typography } from '~/components/ui/foundations/typography/typography';
import { useTranslate } from '~/hooks/use-translate';
import { useInbox } from '../../inbox/api';
import { listStyles } from '../../shared/styles';

const PREVIEW = 3;

/** The latest pending inbox items and how many are waiting; processing happens in the Inbox page. */
export function InboxCard() {
	const t = useTranslate();
	const inbox = useInbox({ page: 1, range: 'all', status: 'pending' }, true);
	const items = (inbox.data?.data ?? []).slice(0, PREVIEW);
	const pending = inbox.data?.meta.counts.pending ?? 0;

	return (
		<section className={`${listStyles.card} flex flex-col gap-3 p-5`}>
			<div className='flex items-center justify-between gap-3'>
				<span className='flex items-center gap-2 text-base font-semibold'>
					{t('today.inbox.title')}
					<Pill variant='outline'>
						<Pill.Text>{pending}</Pill.Text>
					</Pill>
				</span>
				<Link className='flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground' to='/inbox'>
					{t('today.inbox.viewAll')}
					<ArrowRight aria-hidden className='size-3' />
				</Link>
			</div>
			{items.length === 0 ? (
				<Typography.Span className='text-sm text-muted-foreground'>{t('today.inbox.empty')}</Typography.Span>
			) : (
				<ul className='flex flex-col gap-2'>
					{items.map(item => (
						<li key={item.id}>
							<Typography.Span className='block truncate text-sm' title={item.content}>
								{item.content}
							</Typography.Span>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
