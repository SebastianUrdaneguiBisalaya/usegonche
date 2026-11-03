import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '~/lib/api';
import { unwrap } from '~/lib/api-error';
import { type OkBody, unwrapPage } from '../shared/paged';
import { useTasksByIds } from '../shared/task-lookup';

type RemindersResponse = Awaited<ReturnType<typeof api.reminders.$get>>;
export type Reminder = OkBody<RemindersResponse>['data'][number];
export type ReminderType = 'event' | 'note' | 'task';

/** What a reminder points at: exactly one of a task, an event or a note. */
export const reminderType = (reminder: Reminder): ReminderType => (reminder.taskId ? 'task' : reminder.calendarEventId ? 'event' : 'note');
export const targetId = (reminder: Reminder): string => reminder.taskId ?? reminder.calendarEventId ?? reminder.noteId ?? '';

export const remindersKey = ['reminders'] as const;

/** `GET /reminders` (the API caps a page at 100): the page filters and counts them by tab on the client. */
export function useReminders() {
	return useQuery({ queryFn: () => unwrapPage(api.reminders.$get({ query: { page: '1', pageSize: '100' } })), queryKey: [...remindersKey, 'all'] });
}

function useRefresh() {
	const queryClient = useQueryClient();
	return () => queryClient.invalidateQueries({ queryKey: remindersKey });
}

/** `POST /reminders/:id/snooze`: a new time, back to pending. */
export function useSnooze() {
	const refresh = useRefresh();
	return useMutation({
		mutationFn: ({ id, remindAt }: { id: string; remindAt: Date }) => unwrap(api.reminders[':id'].snooze.$post({ json: { remindAt: remindAt.toISOString() }, param: { id } })),
		onSuccess: refresh,
	});
}

/** `POST /reminders/:id/dismiss`; several ids dismiss one after the other. */
export function useDismiss() {
	const refresh = useRefresh();
	return useMutation({
		mutationFn: (ids: string[]) => Promise.all(ids.map(id => unwrap(api.reminders[':id'].dismiss.$post({ param: { id } })))),
		onSuccess: refresh,
	});
}

/** `DELETE /reminders/:id`. */
export function useDeleteReminder() {
	const refresh = useRefresh();
	return useMutation({ mutationFn: (id: string) => unwrap(api.reminders[':id'].$delete({ param: { id } })), onSuccess: refresh });
}

/** `POST /reminders` for a task, event or note. */
export function useCreateReminder() {
	const refresh = useRefresh();
	return useMutation({
		mutationFn: ({ remindAt, target }: { remindAt: Date; target: { eventId: string } | { noteId: string } | { taskId: string } }) =>
			unwrap(api.reminders.$post({ json: { ...target, remindAt: remindAt.toISOString() } })),
		onSuccess: refresh,
	});
}

/** `PATCH /reminders/:id`: reschedules a pending reminder. */
export function useRescheduleReminder() {
	const refresh = useRefresh();
	return useMutation({
		mutationFn: ({ id, remindAt }: { id: string; remindAt: Date }) => unwrap(api.reminders[':id'].$patch({ json: { remindAt: remindAt.toISOString() }, param: { id } })),
		onSuccess: refresh,
	});
}

/** The pending reminder of a task, event or note, if any. */
export function useTargetReminder(target: { eventId: string } | { noteId: string } | { taskId: string }) {
	return useQuery({
		queryFn: async () => (await unwrap(api.reminders.$get({ query: { ...target, pageSize: '1', status: 'pending' } })))[0] ?? null,
		queryKey: [...remindersKey, 'target', target],
	});
}

export interface TargetInfo {
	/** Plain text of the task description or the note body (Markdown as written), when there is one. */
	description: string | null;
	priority?: 'high' | 'low' | 'medium' | 'urgent';
	title: string;
}

/** Titles (and a little context) of what the reminders point at, by target id. */
export function useTargets(reminders: readonly Reminder[]): ReadonlyMap<string, TargetInfo> {
	const taskIds = [...new Set(reminders.flatMap(reminder => (reminder.taskId ? [reminder.taskId] : [])))];
	const noteIds = [...new Set(reminders.flatMap(reminder => (reminder.noteId ? [reminder.noteId] : [])))];
	const eventIds = [...new Set(reminders.flatMap(reminder => (reminder.calendarEventId ? [reminder.calendarEventId] : [])))];

	const tasks = useTasksByIds(taskIds);
	const notes = useQueries({ queries: noteIds.map(id => ({ queryFn: () => unwrap(api.notes[':id'].$get({ param: { id } })), queryKey: ['notes', 'one', id] })) });
	const events = useQueries({ queries: eventIds.map(id => ({ queryFn: () => unwrap(api.planning.events[':id'].$get({ param: { id } })), queryKey: ['planning', 'event', id] })) });

	const map = new Map<string, TargetInfo>();
	for (const task of tasks.data ?? []) map.set(task.id, { description: task.description ?? null, priority: task.priority, title: task.title });
	for (const note of notes) if (note.data) map.set(note.data.id, { description: note.data.body ?? null, title: note.data.title });
	for (const event of events) if (event.data) map.set(event.data.id, { description: null, title: event.data.title });
	return map;
}
