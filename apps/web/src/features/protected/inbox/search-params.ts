import { createLoader, parseAsInteger, parseAsString, parseAsStringLiteral } from 'nuqs/server';

export const inboxStatuses = ['pending', 'archived', 'discarded', 'converted'] as const;
export type InboxStatus = (typeof inboxStatuses)[number];

export const inboxRanges = ['all', '24h', '7d', '30d'] as const;
export type InboxRange = (typeof inboxRanges)[number];

/** Rows per page. Fixed: the table fills the screen and scrolls inside the page. */
export const PAGE_SIZE = 20;

/** Everything the inbox page keeps in the URL, so a reload, a shared link or the back button restore the same view. */
export const inboxParsers = {
	page: parseAsInteger.withDefault(1),
	q: parseAsString.withDefault(''),
	range: parseAsStringLiteral(inboxRanges).withDefault('all'),
	status: parseAsStringLiteral(inboxStatuses).withDefault('pending'),
};

/** Reads the same params from a request (used by the route `loader`). */
export const loadInboxParams = createLoader(inboxParsers);

export interface InboxParams {
	page: number;
	q: string;
	range: InboxRange;
	status: InboxStatus;
}
