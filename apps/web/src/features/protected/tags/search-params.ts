import { createLoader, parseAsInteger, parseAsString, parseAsStringLiteral } from 'nuqs/server';

/** Orders of the list: A–Z, last changed first, newest first, or the tags used most in tasks, projects or notes. */
export const tagSorts = ['name', 'updated', 'created', 'tasks', 'projects', 'notes'] as const;
export type TagSort = (typeof tagSorts)[number];

/** Everything the tags page keeps in the URL, so a reload, a shared link or the back button restore the same view. */
export const tagParsers = {
	page: parseAsInteger.withDefault(1),
	q: parseAsString.withDefault(''),
	sort: parseAsStringLiteral(tagSorts).withDefault('name'),
};

/** Reads the same params from a request (used by the route `loader`). */
export const loadTagsParams = createLoader(tagParsers);

export interface TagsParams {
	page: number;
	q: string;
	sort: TagSort;
}
