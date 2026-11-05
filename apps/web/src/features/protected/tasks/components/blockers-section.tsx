import { OctagonAlert, Plus, Repeat } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/actions-controls/button/button';
import { Pill } from '~/components/ui/data-display/pill/pill';
import { Input } from '~/components/ui/forms-inputs/input/input';
import { Icon } from '~/components/ui/foundations/icon/icon';
import { Skeleton } from '~/components/ui/foundations/skeleton/skeleton';
import { useLanguage } from '~/hooks/use-language';
import { useTranslate } from '~/hooks/use-translate';
import { formatRelative } from '../../shared/relative-time';
import { type Task, useBlockers, useCreateBlocker, useResolveBlocker } from '../api';

const normalize = (reason: string): string => reason.trim().toLowerCase();

/**
 * The manual blockers of a task: a stack of the open reasons, each with "Resolve" and how long it has been open, and the resolved ones as
 * history. A reason that has come back (same text, more than once) is marked as recurring. Informational: a blocked task can still be worked on.
 */
export function BlockersSection({ task }: { task: Task }) {
	const t = useTranslate();
	const { locale } = useLanguage();
	const blockers = useBlockers(task.id, true);
	const create = useCreateBlocker();
	const resolve = useResolveBlocker();
	const [reason, setReason] = useState('');
	const all = blockers.data ?? [];
	const open = all.filter(blocker => !blocker.resolvedAt);
	const resolved = all.filter(blocker => blocker.resolvedAt);
	const recurring = useMemo(() => {
		const counts = new Map<string, number>();
		for (const blocker of all) counts.set(normalize(blocker.reason), (counts.get(normalize(blocker.reason)) ?? 0) + 1);
		return counts;
	}, [all]);

	const add = async () => {
		const text = reason.trim();
		if (!text || create.isPending) return;
		try {
			await create.mutateAsync({ id: task.id, reason: text });
			setReason('');
			toast.success(t('tasks.toast.blockerAdded'));
		} catch {
			// The global mutation handler already toasted the error.
		}
	};

	return (
		<section aria-labelledby={`blockers-${task.id}`} className='flex flex-col gap-3'>
			<h3 className='flex items-center gap-2 text-sm font-medium' id={`blockers-${task.id}`}>
				<Icon aria-hidden className={open.length > 0 ? 'text-destructive' : ''} icon={OctagonAlert} size='sm' />
				{t(open.length === 1 ? 'tasks.blockers.title_one' : 'tasks.blockers.title_other', { count: open.length })}
			</h3>
			{blockers.isPending ? (
				<Skeleton>
					<Skeleton.Item className='h-14 w-full rounded-xl' />
				</Skeleton>
			) : (
				<ul className='flex flex-col gap-2'>
					{open.length === 0 && <li className='text-sm text-muted-foreground'>{t('tasks.blockers.none')}</li>}
					{open.map(blocker => (
						<li className='flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5' key={blocker.id}>
							<div className='flex min-w-0 flex-col gap-1'>
								<span className='text-sm'>{blocker.reason}</span>
								<span className='flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
									{t('tasks.blockers.openFor', { time: formatRelative(blocker.startedAt, locale) })}
									{(recurring.get(normalize(blocker.reason)) ?? 0) > 1 && (
										<Pill variant='warning'>
											<Repeat aria-hidden className='size-3' />
											<Pill.Text>{t('tasks.blockers.recurring', { count: recurring.get(normalize(blocker.reason)) ?? 0 })}</Pill.Text>
										</Pill>
									)}
								</span>
							</div>
							<Button
								className='shrink-0 rounded-full'
								loading={resolve.isPending && resolve.variables?.blockerId === blocker.id}
								onClick={() => resolve.mutate({ blockerId: blocker.id, id: task.id }, { onSuccess: () => toast.success(t('tasks.toast.blockerResolved')) })}
								variant='secondary'
							>
								<Button.Text>{t('tasks.blockers.resolve')}</Button.Text>
							</Button>
						</li>
					))}
				</ul>
			)}
			{resolved.length > 0 && (
				<details className='text-sm'>
					<summary className='cursor-pointer text-muted-foreground'>
						{t(resolved.length === 1 ? 'tasks.blockers.resolved_one' : 'tasks.blockers.resolved_other', { count: resolved.length })}
					</summary>
					<ul className='mt-2 flex flex-col gap-1'>
						{resolved.map(blocker => (
							<li className='flex items-center justify-between gap-3 px-1 text-muted-foreground' key={blocker.id}>
								<span className='min-w-0 truncate line-through'>{blocker.reason}</span>
								<span className='shrink-0 text-xs'>{blocker.resolvedAt ? formatRelative(blocker.resolvedAt, locale) : ''}</span>
							</li>
						))}
					</ul>
				</details>
			)}
			<Input className='rounded-xl border-border bg-foreground/[0.03] px-3 py-2 focus-within:border-border-strong'>
				<Input.Icon icon={Plus} />
				<Input.Field
					aria-label={t('tasks.blockers.add')}
					autoComplete='off'
					maxLength={500}
					onChange={event => setReason(event.target.value)}
					onKeyDown={event => {
						if (event.key === 'Enter') {
							event.preventDefault();
							void add();
						}
					}}
					placeholder={t('tasks.blockers.add')}
					value={reason}
				/>
			</Input>
		</section>
	);
}
