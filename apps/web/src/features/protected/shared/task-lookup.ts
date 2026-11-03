import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useDebouncedValue } from '~/hooks/use-debounced-value';
import { api } from '~/lib/api';
import { unwrap } from '~/lib/api-error';

const PICK_SHOWN = 8;

/** Tasks whose title contains `q` (`GET /tasks?title=`, one request per pause in typing), to pick one: the task a task waits for, the task a note links to. */
export function useTaskSearch(q: string) {
	const text = q.trim();
	const needle = useDebouncedValue(text, 250);
	const tasks = useQuery({
		enabled: needle !== '',
		placeholderData: keepPreviousData,
		queryFn: () => unwrap(api.tasks.$get({ query: { order: 'desc', page: '1', pageSize: String(PICK_SHOWN), sort: 'updatedAt', title: needle } })),
		queryKey: ['tasks', 'pick', needle],
	});
	const typing = needle !== text;
	return { data: text === '' ? [] : (tasks.data ?? []), isFetching: typing || (needle !== '' && tasks.isFetching), isPending: typing || (needle !== '' && tasks.isPending) };
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
