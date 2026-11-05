import { ArrowRight, GitBranch, Search, TriangleAlert, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/actions-controls/button/button';
import { Input } from '~/components/ui/forms-inputs/input/input';
import { Icon } from '~/components/ui/foundations/icon/icon';
import { Skeleton } from '~/components/ui/foundations/skeleton/skeleton';
import { useTranslate } from '~/hooks/use-translate';
import { ApiError, getApiErrorMessage } from '~/lib/api-error';
import { useTaskSearch, useTasksByIds } from '../../shared/task-lookup';
import { type Task, useAddDependency, useCyclePreview, useRemoveDependency } from '../api';
import { statusColor, statusIcon } from '../display';

function TaskLink({ onOpen, task }: { onOpen: (id: string) => void; task: Task }) {
	return (
		<button className='flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left text-sm' onClick={() => onOpen(task.id)} type='button'>
			<Icon aria-hidden className={statusColor[task.status]} icon={statusIcon[task.status]} size='sm' />
			<span className='truncate'>{task.title}</span>
		</button>
	);
}

/** Picks the task this one will wait for: search by title, then a preview of the cycle (if any) before confirming. */
function DependencyPicker({ task }: { task: Task }) {
	const t = useTranslate();
	const [query, setQuery] = useState('');
	const [candidate, setCandidate] = useState<{ id: string; title: string } | undefined>(undefined);
	const search = useTaskSearch(query);
	const cycle = useCyclePreview(task.id, candidate?.id);
	const add = useAddDependency();
	const taken = new Set([task.id, ...task.dependsOnIds]);
	const hits = (search.data ?? []).filter(hit => !taken.has(hit.id));

	const confirm = async () => {
		if (!candidate) return;
		try {
			await add.mutateAsync({ dependsOnId: candidate.id, id: task.id });
			setCandidate(undefined);
			setQuery('');
			toast.success(t('tasks.dependencies.added'));
		} catch (error) {
			// 409: a cycle the preview could not see (the graph changed meanwhile).
			toast.error(error instanceof ApiError && error.status === 409 ? t('tasks.dependencies.cycle') : getApiErrorMessage(error));
		}
	};

	if (candidate) {
		const chain = cycle.data?.chain;
		return (
			<div className='flex flex-col gap-3 rounded-xl border border-border bg-foreground/[0.03] p-3'>
				<p className='text-sm'>{t('tasks.dependencies.confirm', { candidate: candidate.title, title: task.title })}</p>
				{cycle.isPending && (
					<Skeleton>
						<Skeleton.Item className='h-4 w-2/3' />
					</Skeleton>
				)}
				{chain && (
					<div className='flex flex-col gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive' role='alert'>
						<span className='flex items-center gap-2 font-medium'>
							<TriangleAlert aria-hidden className='size-4' />
							{t('tasks.dependencies.cyclePreview')}
						</span>
						<span className='flex flex-wrap items-center gap-1.5'>
							{[{ id: task.id, title: task.title }, ...chain.slice().reverse(), { id: `${task.id}-end`, title: task.title }].map((node, index, all) => (
								<span className='flex items-center gap-1.5' key={node.id}>
									<span className='rounded-md bg-background/60 px-2 py-0.5'>{node.title}</span>
									{index < all.length - 1 && <ArrowRight aria-hidden className='size-3' />}
								</span>
							))}
						</span>
					</div>
				)}
				<div className='flex justify-end gap-2'>
					<Button onClick={() => setCandidate(undefined)} variant='ghost'>
						<Button.Text>{t('tasks.form.cancel')}</Button.Text>
					</Button>
					<Button disabled={cycle.isPending || Boolean(chain)} loading={add.isPending} onClick={() => void confirm()}>
						<Button.Text>{t('tasks.dependencies.confirmAction')}</Button.Text>
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className='flex flex-col gap-2'>
			<Input className='rounded-xl border-border bg-foreground/[0.03] px-3 py-2 focus-within:border-border-strong'>
				<Input.Icon icon={Search} />
				<Input.Field
					aria-label={t('tasks.dependencies.search')}
					autoComplete='off'
					onChange={event => setQuery(event.target.value)}
					placeholder={t('tasks.dependencies.search')}
					value={query}
				/>
			</Input>
			{query.trim() !== '' && (
				<ul className='flex flex-col gap-1'>
					{search.isPending && (
						<li>
							<Skeleton>
								<Skeleton.Item className='h-8 w-full rounded-lg' />
							</Skeleton>
						</li>
					)}
					{!search.isPending && hits.length === 0 && <li className='px-2 py-2 text-xs text-muted-foreground'>{t('tasks.dependencies.noResults')}</li>}
					{hits.map(hit => (
						<li key={hit.id}>
							<button
								className='w-full cursor-pointer truncate rounded-lg px-2 py-2 text-left text-sm hover:bg-foreground/[0.06]'
								onClick={() => setCandidate({ id: hit.id, title: hit.title })}
								type='button'
							>
								{hit.title}
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

/** "Waits for" (with a picker and cycle preview) and "Blocks" (the tasks that wait for this one). Informational: it never stops any action. */
export function DependenciesSection({ onOpen, task }: { onOpen: (id: string) => void; task: Task }) {
	const t = useTranslate();
	const waitsFor = useTasksByIds(task.dependsOnIds);
	const blocks = useTasksByIds(task.blocksIds);
	const remove = useRemoveDependency();

	return (
		<section aria-labelledby={`dependencies-${task.id}`} className='flex flex-col gap-4'>
			<h3 className='flex items-center gap-2 text-sm font-medium' id={`dependencies-${task.id}`}>
				<Icon aria-hidden icon={GitBranch} size='sm' />
				{t('tasks.dependencies.title')}
			</h3>
			<div className='flex flex-col gap-2'>
				<span className='text-xs text-muted-foreground'>
					{t(task.dependsOnIds.length === 1 ? 'tasks.dependencies.waitsFor_one' : 'tasks.dependencies.waitsFor_other', { count: task.dependsOnIds.length })}
				</span>
				{waitsFor.isPending && task.dependsOnIds.length > 0 ? (
					<Skeleton>
						<Skeleton.Item className='h-9 w-full rounded-lg' />
					</Skeleton>
				) : (
					<ul className='flex flex-col gap-1'>
						{(waitsFor.data ?? []).map(dependency => (
							<li className='flex items-center gap-2 rounded-lg border border-border bg-foreground/[0.03] px-3 py-2' key={dependency.id}>
								<TaskLink onOpen={onOpen} task={dependency} />
								<Button
									aria-label={t('tasks.dependencies.remove', { title: dependency.title })}
									className='size-7 shrink-0 rounded-full p-0 text-muted-foreground'
									loading={remove.isPending && remove.variables?.dependsOnId === dependency.id}
									onClick={() => remove.mutate({ dependsOnId: dependency.id, id: task.id }, { onSuccess: () => toast.success(t('tasks.toast.dependencyRemoved')) })}
									size='icon'
									variant='ghost'
								>
									<Button.Icon icon={X} />
								</Button>
							</li>
						))}
					</ul>
				)}
				<DependencyPicker task={task} />
			</div>
			<div className='flex flex-col gap-2'>
				<span className='text-xs text-muted-foreground'>
					{t(task.blocksIds.length === 1 ? 'tasks.dependencies.blocks_one' : 'tasks.dependencies.blocks_other', { count: task.blocksIds.length })}
				</span>
				{blocks.isPending && task.blocksIds.length > 0 ? (
					<Skeleton>
						<Skeleton.Item className='h-9 w-full rounded-lg' />
					</Skeleton>
				) : (
					<ul className='flex flex-col gap-1'>
						{(blocks.data ?? []).map(dependent => (
							<li className='flex items-center gap-2 rounded-lg border border-border bg-foreground/[0.03] px-3 py-2' key={dependent.id}>
								<TaskLink onOpen={onOpen} task={dependent} />
							</li>
						))}
					</ul>
				)}
			</div>
		</section>
	);
}
