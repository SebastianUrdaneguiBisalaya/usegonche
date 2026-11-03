import { createLoader, parseAsArrayOf, parseAsBoolean, parseAsInteger, parseAsString, parseAsStringLiteral } from 'nuqs/server';

export const taskStatuses = ['todo', 'in_progress', 'done', 'cancelled'] as const;
export type TaskStatus = (typeof taskStatuses)[number];

export const taskPriorities = ['low', 'medium', 'high', 'urgent'] as const;
export type TaskPriority = (typeof taskPriorities)[number];

/** The Board shows a column per status; the List is a paginated table; Recurring lists the recurrence rules. */
export const taskViews = ['board', 'list', 'recurring'] as const;
export type TaskView = (typeof taskViews)[number];

/** Orders of the list: newest first, soonest due first, most urgent first, by title, or last changed. */
export const taskSorts = ['created', 'due', 'priority', 'title', 'updated'] as const;
export type TaskSort = (typeof taskSorts)[number];

/** What the List groups its rows by (inside the loaded page). */
export const taskGroups = ['none', 'project', 'goal', 'due', 'priority'] as const;
export type TaskGroup = (typeof taskGroups)[number];

/** Due-date filter: any, today, the next 7 days, overdue (open tasks only) or tasks with no date. */
export const taskDues = ['any', 'today', 'week', 'overdue', 'none'] as const;
export type TaskDue = (typeof taskDues)[number];

/** Value of the project filter that means "tasks with no project". */
export const NO_PROJECT = 'none';

/** Statuses shown by default: the board of the reference has no Cancelled column until it is switched on. */
export const defaultStatuses: TaskStatus[] = ['todo', 'in_progress', 'done'];

/** Everything the tasks page keeps in the URL, so a reload, a shared link or the back button restore the same view. */
export const taskParsers = {
	blocked: parseAsBoolean.withDefault(false),
	due: parseAsStringLiteral(taskDues).withDefault('any'),
	goal: parseAsString.withDefault(''),
	group: parseAsStringLiteral(taskGroups).withDefault('none'),
	page: parseAsInteger.withDefault(1),
	project: parseAsString.withDefault(''),
	q: parseAsString.withDefault(''),
	sort: parseAsStringLiteral(taskSorts).withDefault('created'),
	status: parseAsArrayOf(parseAsStringLiteral(taskStatuses)).withDefault(defaultStatuses),
	tag: parseAsString.withDefault(''),
	view: parseAsStringLiteral(taskViews).withDefault('board'),
};

/** Reads the same params from a request. */
export const loadTaskParams = createLoader(taskParsers);

export interface TasksParams {
	blocked: boolean;
	due: TaskDue;
	/** Goal id, or empty for every goal. */
	goal: string;
	page: number;
	/** Project id, `NO_PROJECT`, or empty for every project. */
	project: string;
	sort: TaskSort;
	status: TaskStatus[];
	/** Tag id, or empty for every tag. */
	tag: string;
}
