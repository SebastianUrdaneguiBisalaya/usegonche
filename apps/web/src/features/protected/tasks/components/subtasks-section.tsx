import { ListChecks, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Progress } from '~/components/ui/data-display/progress/progress';
import { Checkbox } from '~/components/ui/forms-inputs/checkbox/checkbox';
import { Input } from '~/components/ui/forms-inputs/input/input';
import { Icon } from '~/components/ui/foundations/icon/icon';
import { Skeleton } from '~/components/ui/foundations/skeleton/skeleton';
import { cn } from '~/components/ui/utils/tailwind/cn';
import { useTranslate } from '~/hooks/use-translate';
import { getApiErrorMessage } from '~/lib/api-error';
import { type Task, useCreateTask, useSubtasks, useUpdateTask } from '../api';

/** The subtasks of a task as a checklist (one level only) with its progress bar, and a field to add another. A subtask has none of its own. */
export function SubtasksSection({ onOpen, task }: { onOpen: (id: string) => void; task: Task }) {
	const t = useTranslate();
	const subtasks = useSubtasks(task.id, true);
	const create = useCreateTask();
	const update = useUpdateTask();
	const [title, setTitle] = useState('');
	const items = subtasks.data ?? [];
	const counted = items.filter(item => item.status !== 'cancelled');
	const done = counted.filter(item => item.status === 'done').length;

	if (task.parentId) return null;

	const add = async () => {
		const text = title.trim();
		if (!text || create.isPending) return;
		try {
			await create.mutateAsync({ parentId: task.id, title: text });
			setTitle('');
		} catch (error) {
			toast.error(getApiErrorMessage(error));
		}
	};

	return (
		<section aria-labelledby={`subtasks-${task.id}`} className='flex flex-col gap-3'>
			<div className='flex items-center justify-between gap-3'>
				<h3 className='flex items-center gap-2 text-sm font-medium' id={`subtasks-${task.id}`}>
					<Icon aria-hidden icon={ListChecks} size='sm' />
					{t('tasks.subtasks.title', { done, total: counted.length })}
				</h3>
			</div>
			{counted.length > 0 && (
				<Progress aria-label={t('tasks.card.subtasks', { done, total: counted.length })} value={Math.round((done / counted.length) * 100)}>
					<Progress.Indicator className='h-1.5' />
					<Progress.Label />
				</Progress>
			)}
			{subtasks.isPending ? (
				<Skeleton className='gap-2'>
					{[0, 1].map(key => (
						<Skeleton.Item className='h-8 w-full rounded-lg' key={key} />
					))}
				</Skeleton>
			) : (
				<ul className='flex flex-col gap-1'>
					{items.map(item => (
						<li className='flex items-center gap-3 rounded-lg px-1 py-1.5' key={item.id}>
							<Checkbox checked={item.status === 'done'} onCheckedChange={checked => update.mutate({ changes: { status: checked ? 'done' : 'todo' }, id: item.id })}>
								<Checkbox.Toggle />
								<Checkbox.Label className='sr-only'>{t('tasks.subtasks.toggle', { title: item.title })}</Checkbox.Label>
							</Checkbox>
							<button
								className={cn(
									'min-w-0 flex-1 cursor-pointer truncate text-left text-sm',
									item.status === 'done' || item.status === 'cancelled' ? 'text-muted-foreground line-through' : ''
								)}
								onClick={() => onOpen(item.id)}
								type='button'
							>
								{item.title}
							</button>
						</li>
					))}
				</ul>
			)}
			<Input className='rounded-xl border-border bg-foreground/[0.03] px-3 py-2 focus-within:border-border-strong'>
				<Input.Icon icon={Plus} />
				<Input.Field
					aria-label={t('tasks.subtasks.add')}
					autoComplete='off'
					maxLength={200}
					onChange={event => setTitle(event.target.value)}
					onKeyDown={event => {
						if (event.key === 'Enter') {
							event.preventDefault();
							void add();
						}
					}}
					placeholder={t('tasks.subtasks.add')}
					value={title}
				/>
			</Input>
		</section>
	);
}
