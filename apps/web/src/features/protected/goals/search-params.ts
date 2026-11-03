import { createLoader, parseAsInteger, parseAsString, parseAsStringLiteral } from 'nuqs/server';

/** One tab per lifecycle status, plus the archived goals (being archived is separate from the status). */
export const goalTabs = ['active', 'achieved', 'archived'] as const;
export type GoalTab = (typeof goalTabs)[number];

/** The statuses a goal can be set to (everything but `archived`). */
export const goalStatuses = ['active', 'achieved'] as const;
export type GoalStatus = (typeof goalStatuses)[number];

/** Orders of the list: last changed first, newest first, soonest target date, or by title. */
export const goalSorts = ['updated', 'created', 'targetDate', 'title'] as const;
export type GoalSort = (typeof goalSorts)[number];

/** Target-date filter: every goal, the overdue ones, or the ones due in the next days. */
export const goalDues = ['all', 'overdue', 'soon'] as const;
export type GoalDue = (typeof goalDues)[number];

/** Everything the goals page keeps in the URL, so a reload, a shared link or the back button restore the same view. */
export const goalParsers = {
	due: parseAsStringLiteral(goalDues).withDefault('all'),
	page: parseAsInteger.withDefault(1),
	sort: parseAsStringLiteral(goalSorts).withDefault('updated'),
	status: parseAsStringLiteral(goalTabs).withDefault('active'),
};

/** Reads the same params from a request (used by the route `loader`). */
export const loadGoalsParams = createLoader(goalParsers);

export interface GoalsParams {
	due: GoalDue;
	page: number;
	sort: GoalSort;
	status: GoalTab;
}
