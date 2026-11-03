import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '~/lib/api';
import { unwrap } from '~/lib/api-error';

/** Tasks found by title, to pick one (the task a task waits for, the task a note links to). */
export function useTaskSearch(q: string) {
	return useQuery({
		enabled: q.trim().length > 0,
		placeholderData: keepPreviousData,
		queryFn: () => unwrap(api.search.$get({ query: { pageSize: '8', q: q.trim(), types: 'task' } })),
		queryKey: ['tasks', 'pick', q.trim()],
	});
}

/** Tasks by id, so a screen can show the titles of the ones it only knows by id. */
export function useTasksByIds(ids: readonly string[]) {
	const key = [...ids].sort().join(',');
	return useQuery({
		enabled: ids.length > 0,
		queryFn: async () => Promise.all(ids.map(id => unwrap(api.tasks[':id'].$get({ param: { id } })))),
		queryKey: ['tasks', 'by-ids', key],
	});
}
