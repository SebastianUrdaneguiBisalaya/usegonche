import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Body } from '~/lib/api';
import { unwrap } from '~/lib/api-error';

export type CreateTagBody = Body<typeof api.tags.$post>;

/** The tags a picker offers (the API caps a page at 100, plenty for a personal list), A–Z. */
export function useTagOptions() {
	return useQuery({ queryFn: () => unwrap(api.tags.$get({ query: { pageSize: '100' } })), queryKey: ['tags', 'options'], staleTime: 60_000 });
}

/** Creates a tag (from the Tags page or a tag picker) and refreshes every tag list before resolving. A tag has no color until the user sets one. */
export function useCreateTag() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (json: CreateTagBody) => unwrap(api.tags.$post({ json })),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tags'] }),
	});
}
