import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '~/lib/api';
import { type Data, unwrap } from '~/lib/api-error';

type EventsResponse = Awaited<ReturnType<typeof api.planning.events.$get>>;

/** A calendar event as the API returns it (instants are UTC ISO strings; all-day events span whole local days). */
export type CalendarEventItem = Data<EventsResponse>[number];

export type EventKind = CalendarEventItem['kind'];

export type EventInput = { allDay: true; endDate: string; kind: EventKind; startDate: string; title: string } | { allDay: false; endsAt: string; kind: EventKind; startsAt: string; title: string };

export const eventsKey = (from: string, to: string) => ['planning', 'events', from, to] as const;

/** `GET /planning/events`: the events overlapping the local dates `from`..`to` (inclusive, at most 62 days). */
export function useEvents(from: string, to: string) {
	return useQuery({ queryFn: () => unwrap(api.planning.events.$get({ query: { from, to } })), queryKey: eventsKey(from, to) });
}

/** An event changes the capacity of its day, the calendar and Today, so everything under `planning` refetches. */
function useRefreshPlanning() {
	const queryClient = useQueryClient();
	return () => queryClient.invalidateQueries({ queryKey: ['planning'] });
}

/** `POST /planning/events`. */
export function useCreateEvent() {
	const refresh = useRefreshPlanning();
	return useMutation({ mutationFn: (json: EventInput) => unwrap(api.planning.events.$post({ json })), onSuccess: refresh });
}

/** `PATCH /planning/events/:id`: send the range fields of the (new) `allDay` mode. */
export function useUpdateEvent() {
	const refresh = useRefreshPlanning();
	return useMutation({
		mutationFn: ({ id, ...json }: Partial<EventInput> & { id: string }) => unwrap(api.planning.events[':id'].$patch({ json, param: { id } })),
		onSuccess: refresh,
	});
}

/** `DELETE /planning/events/:id`. */
export function useDeleteEvent() {
	const refresh = useRefreshPlanning();
	return useMutation({ mutationFn: (id: string) => unwrap(api.planning.events[':id'].$delete({ param: { id } })), onSuccess: refresh });
}
