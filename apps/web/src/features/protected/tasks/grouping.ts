import type { Task } from './api';
import { daysUntil, isOpen } from './display';
import { type TaskGroup, taskPriorities } from './search-params';

export interface TaskGroupBucket {
	/** Key under which the label is translated or looked up (`overdue`, `high`, a project id, ...). */
	key: string;
	tasks: Task[];
}

const DUE_BUCKETS = ['overdue', 'today', 'week', 'later', 'none'] as const;
export type DueBucket = (typeof DUE_BUCKETS)[number];

const dueBucket = (task: Task): DueBucket => {
	if (!task.dueDate) return 'none';
	const days = daysUntil(task.dueDate.slice(0, 10));
	if (days < 0) return isOpen(task.status) ? 'overdue' : 'later';
	if (days === 0) return 'today';
	return days <= 6 ? 'week' : 'later';
};

/** Key of the group a task falls in. A task with no project / goal gets `none`. */
const keyOf = (task: Task, group: Exclude<TaskGroup, 'none'>): string => {
	if (group === 'project') return task.projectId ?? 'none';
	if (group === 'goal') return task.goalId ?? 'none';
	if (group === 'priority') return task.priority;
	return dueBucket(task);
};

/**
 * Splits the loaded tasks into groups, keeping the order of the tasks inside each group. Priority and due go in their natural order
 * (urgent first, overdue first); projects and goals by name, with "none" last.
 */
export function groupTasks(tasks: readonly Task[], group: TaskGroup, titles: ReadonlyMap<string, string>): TaskGroupBucket[] {
	if (group === 'none') return [{ key: 'all', tasks: [...tasks] }];
	const buckets = new Map<string, Task[]>();
	for (const task of tasks) {
		const key = keyOf(task, group);
		buckets.set(key, [...(buckets.get(key) ?? []), task]);
	}
	const rank = (key: string): number => {
		if (group === 'priority') return taskPriorities.length - taskPriorities.indexOf(key as (typeof taskPriorities)[number]);
		if (group === 'due') return DUE_BUCKETS.indexOf(key as DueBucket);
		return 0;
	};
	return [...buckets.entries()]
		.sort(([a], [b]) => {
			if (a === 'none' || b === 'none') return a === 'none' ? (b === 'none' ? 0 : 1) : -1;
			if (group === 'priority' || group === 'due') return rank(a) - rank(b);
			return (titles.get(a) ?? '').localeCompare(titles.get(b) ?? '');
		})
		.map(([key, items]) => ({ key, tasks: items }));
}
