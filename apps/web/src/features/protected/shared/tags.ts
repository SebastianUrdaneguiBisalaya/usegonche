import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TagColor } from '~/components/ui/data-display/tag/tag';
import { api } from '~/lib/api';
import { unwrap } from '~/lib/api-error';
import { pickBy } from './display';

const TAG_COLORS: readonly TagColor[] = ['blue', 'green', 'amber', 'rose', 'violet', 'teal'];

/** Tags have no color of their own: each name always gets the same one, so a tag reads the same on every page. */
export const tagColor = (name: string): TagColor => pickBy(TAG_COLORS, name.toLowerCase(), 'default');

/** The dot of each tag color (the same `--chart-*` tokens the `Tag` chip uses). */
const TAG_DOTS: Record<TagColor, string> = {
	amber: 'bg-chart-2',
	blue: 'bg-chart-1',
	default: 'bg-muted-foreground',
	green: 'bg-chart-3',
	outline: 'bg-muted-foreground',
	rose: 'bg-chart-4',
	teal: 'bg-chart-6',
	violet: 'bg-chart-5',
};

export const tagDot = (name: string): string => TAG_DOTS[tagColor(name)];

/** The tags a picker offers (the API caps a page at 100, plenty for a personal list), A–Z. */
export function useTagOptions() {
	return useQuery({ queryFn: () => unwrap(api.tags.$get({ query: { pageSize: '100' } })), queryKey: ['tags', 'options'], staleTime: 60_000 });
}

/** Creates a tag (from the Tags page or a tag picker) and refreshes every tag list before resolving. */
export function useCreateTag() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (name: string) => unwrap(api.tags.$post({ json: { name } })),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tags'] }),
	});
}
