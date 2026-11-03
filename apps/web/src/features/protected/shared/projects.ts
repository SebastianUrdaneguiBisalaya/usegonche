import { useQuery } from '@tanstack/react-query';
import { api } from '~/lib/api';
import { unwrap } from '~/lib/api-error';

/** The projects a pill select offers (the API caps a page at 100, plenty for a personal list). */
export function useProjectOptions() {
	return useQuery({ queryFn: () => unwrap(api.projects.$get({ query: { archived: 'false', pageSize: '100' } })), queryKey: ['projects', 'options'], staleTime: 60_000 });
}
