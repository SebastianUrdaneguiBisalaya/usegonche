import { z } from 'zod';
import { hasChanges } from '../../lib/diff.js';
import { addDays, isValidDate } from '../../lib/time.js';

export const MAX_RANGE_DAYS = 62;

const instant = z.iso.datetime({ offset: true }).transform(value => new Date(value));
const calendarDate = z.string().refine(isValidDate, 'invalid_date');
const title = z.string().trim().min(1).max(200);

export const dateParamSchema = z.object({ date: calendarDate });
export const idParamSchema = z.object({ id: z.uuid() });

/** `from`/`to` are local calendar dates, both inclusive, at most 62 days apart. */
const rangeQuery = {
	from: calendarDate,
	to: calendarDate,
};
const validRange = (value: { from: string; to: string }) => value.to >= value.from && value.to <= addDays(value.from, MAX_RANGE_DAYS - 1);
const validRangeIssue = { message: 'invalid_range', path: ['to'] };

// Availability ---------------------------------------------------------------------------------------------------------

const windowSchema = z
	.strictObject({
		endMinute: z.number().int().min(1).max(1440),
		startMinute: z.number().int().min(0).max(1439),
		weekday: z.number().int().min(1).max(7),
	})
	.refine(window => window.endMinute > window.startMinute, { message: 'end_before_start', path: ['endMinute'] });

/** Replaces the whole weekly template. Windows of the same weekday must not overlap. */
export const setAvailabilitySchema = z
	.strictObject({ windows: z.array(windowSchema).max(70) })
	.refine(
		({ windows }) =>
			windows.every((window, index) =>
				windows.every((other, otherIndex) => otherIndex <= index || other.weekday !== window.weekday || other.startMinute >= window.endMinute || window.startMinute >= other.endMinute)
			),
		{ message: 'overlapping_windows', path: ['windows'] }
	);

export type AvailabilityInput = z.infer<typeof setAvailabilitySchema>['windows'];

// Calendar events ------------------------------------------------------------------------------------------------------

const kind = z.enum(['event', 'out_of_office']);

const timedEvent = z
	.strictObject({ allDay: z.literal(false).default(false), endsAt: instant, kind: kind.default('event'), startsAt: instant, title })
	.refine(event => event.endsAt > event.startsAt, { message: 'end_before_start', path: ['endsAt'] });

/** All-day events give calendar dates (`endDate` inclusive, defaults to `startDate`). */
const allDayEvent = z
	.strictObject({ allDay: z.literal(true), endDate: calendarDate.optional(), kind: kind.default('event'), startDate: calendarDate, title })
	.refine(event => !event.endDate || event.endDate >= event.startDate, { message: 'end_before_start', path: ['endDate'] });

export const createEventSchema = z.union([allDayEvent, timedEvent]);

/** Send the range fields that match the (new) `allDay` mode; missing ones are taken from the stored event. */
export const updateEventSchema = z
	.strictObject({
		allDay: z.boolean(),
		endDate: calendarDate,
		endsAt: instant,
		kind,
		startDate: calendarDate,
		startsAt: instant,
		title,
	})
	.partial()
	.refine(hasChanges, 'empty_update');

export const listEventsQuerySchema = z.object(rangeQuery).refine(validRange, validRangeIssue);

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;

// Daily plan -----------------------------------------------------------------------------------------------------------

/** Ordered list of task ids planned for the day; replaces the whole plan. */
export const setDayItemsSchema = z.strictObject({
	taskIds: z
		.array(z.uuid())
		.max(100)
		.refine(ids => new Set(ids).size === ids.length, 'duplicate_task'),
});

// Time blocks ----------------------------------------------------------------------------------------------------------

const plannedRange = { plannedEnd: instant, plannedStart: instant };
const validPlannedRange = (value: { plannedEnd: Date; plannedStart: Date }) => value.plannedEnd > value.plannedStart;
const plannedRangeIssue = { message: 'end_before_start', path: ['plannedEnd'] };

export const createBlockSchema = z
	.strictObject({ ...plannedRange, taskId: z.uuid().nullish(), title: title.nullish() })
	.refine(validPlannedRange, plannedRangeIssue)
	.refine(value => Boolean(value.taskId || value.title), { message: 'task_or_title', path: ['title'] });

export const moveBlockSchema = z.strictObject(plannedRange).refine(validPlannedRange, plannedRangeIssue);

/** Close a planned block (`done`, `missed`, `interrupted`) and/or record what really happened. `interrupted` needs both actual times. */
export const updateBlockSchema = z
	.strictObject({
		actualEnd: instant,
		actualStart: instant,
		status: z.enum(['done', 'missed', 'interrupted']),
		title,
	})
	.partial()
	.refine(hasChanges, 'empty_update')
	.refine(value => !(value.actualStart && value.actualEnd) || value.actualEnd > value.actualStart, { message: 'end_before_start', path: ['actualEnd'] })
	.refine(value => value.status !== 'interrupted' || Boolean(value.actualStart && value.actualEnd), { message: 'actual_required', path: ['actualStart'] });

/** `from` and `to` come together; they are required unless `taskId` is given (then no range lists every block of that task). */
export const listBlocksQuerySchema = z
	.object({
		from: calendarDate.optional(),
		status: z.enum(['planned', 'done', 'missed', 'interrupted', 'rescheduled']).optional(),
		taskId: z.uuid().optional(),
		to: calendarDate.optional(),
	})
	.refine(value => (value.from === undefined) === (value.to === undefined) && (value.taskId !== undefined || value.from !== undefined), { message: 'range_required', path: ['from'] })
	.refine(value => value.from === undefined || value.to === undefined || validRange({ from: value.from, to: value.to }), validRangeIssue);

export const replanQuerySchema = z.object({
	date: calendarDate,
	/** How many days after `date` to look for free time (default 7). */
	days: z.coerce.number().int().min(1).max(14).default(7),
});

export type CreateBlockInput = z.infer<typeof createBlockSchema>;
export type MoveBlockInput = z.infer<typeof moveBlockSchema>;
export type UpdateBlockInput = z.infer<typeof updateBlockSchema>;
