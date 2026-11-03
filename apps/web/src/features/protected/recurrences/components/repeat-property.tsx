import { Repeat } from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/actions-controls/button/button';
import { useLanguage } from '~/hooks/use-language';
import { useTranslate } from '~/hooks/use-translate';
import type { Task } from '../../tasks/api';
import { useRecurrence } from '../api';
import { describeRule } from '../rule';
import { RecurrenceModal } from './recurrence-modal';

/**
 * "Repeat" row of the task drawer. An occurrence shows how its rule repeats and lets you edit the rule; any other task can be made recurring,
 * which creates a new rule from its fields (the task itself stays as it is).
 */
export function RepeatProperty({ task }: { task: Task }) {
	const t = useTranslate();
	const { locale } = useLanguage();
	const [open, setOpen] = useState(false);
	const rule = useRecurrence(task.recurrenceId);
	const isOccurrence = Boolean(task.recurrenceId);

	return (
		<>
			<Button className='w-fit rounded-full px-3 py-1.5 text-sm' disabled={isOccurrence && !rule.data} onClick={() => setOpen(true)} variant='ghost'>
				<Button.Icon icon={Repeat} />
				<Button.Text>{isOccurrence ? (rule.data ? describeRule(rule.data.rule, t, locale) : t('recurrences.drawer.loading')) : t('recurrences.drawer.make')}</Button.Text>
			</Button>
			{isOccurrence ? (
				<RecurrenceModal onOpenChange={setOpen} open={open} recurrence={rule.data} />
			) : (
				<RecurrenceModal
					onOpenChange={setOpen}
					open={open}
					prefill={{
						description: task.description,
						estimatedMinutes: task.estimatedMinutes,
						goalId: task.goalId,
						priority: task.priority,
						projectId: task.projectId,
						tagIds: task.tags.map(tag => tag.id),
						title: task.title,
					}}
				/>
			)}
		</>
	);
}
