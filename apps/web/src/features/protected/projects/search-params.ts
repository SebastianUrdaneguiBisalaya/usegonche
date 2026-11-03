import { createLoader, parseAsInteger, parseAsString, parseAsStringLiteral } from 'nuqs/server';

/** One tab per lifecycle status, plus the archived projects (being archived is separate from the status). */
export const projectTabs = ['active', 'on_hold', 'completed', 'archived'] as const;
export type ProjectTab = (typeof projectTabs)[number];

/** Orders of the list: last changed first, newest first, or by title. */
export const projectSorts = ['updated', 'created', 'title'] as const;
export type ProjectSort = (typeof projectSorts)[number];

/** The statuses a project can be set to (everything but `archived`). */
export const projectStatuses = ['active', 'on_hold', 'completed'] as const;
export type ProjectStatus = (typeof projectStatuses)[number];

/** Everything the projects page keeps in the URL, so a reload, a shared link or the back button restore the same view. */
export const projectParsers = {
	goal: parseAsString.withDefault(''),
	page: parseAsInteger.withDefault(1),
	sort: parseAsStringLiteral(projectSorts).withDefault('updated'),
	status: parseAsStringLiteral(projectTabs).withDefault('active'),
	tag: parseAsString.withDefault(''),
};

/** Reads the same params from a request (used by the route `loader`). */
export const loadProjectsParams = createLoader(projectParsers);

export interface ProjectsParams {
	/** Goal id, or empty for every goal. */
	goal: string;
	page: number;
	sort: ProjectSort;
	status: ProjectTab;
	/** Tag id, or empty for every tag. */
	tag: string;
}
