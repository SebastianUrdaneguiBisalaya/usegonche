import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/actions-controls/button/button';
import { Switch } from '~/components/ui/actions-controls/switch/switch';
import { Input } from '~/components/ui/forms-inputs/input/input';
import { Select } from '~/components/ui/forms-inputs/select/select';
import { Layout } from '~/components/ui/layout/layout/layout';
import { Modal } from '~/components/ui/overlays-feedback/modal/modal';
import { useTranslate } from '~/hooks/use-translate';
import { getApiErrorMessage } from '~/lib/api-error';
import { minuteInZone, todayInZone } from '~/lib/datetime';
import { listStyles } from '../../shared/styles';
import { useDateTime } from '../../shared/use-datetime';
import { fromTimeValue, toTimeValue } from '../../today/blocks';
import { type CalendarEventItem, type EventInput, type EventKind, useCreateEvent, useUpdateEvent } from '../api';

export type EventModalState = { allDay?: boolean; date: string; kind: 'create'; startMinute: number } | { event: CalendarEventItem; kind: 'edit' };

interface EventModalProps {
	onClose: () => void;
	/** Asks the page to confirm and delete the event being edited. */
	onDelete: (event: CalendarEventItem) => void;
	state: EventModalState | undefined;
}

const KINDS: EventKind[] = ['event', 'out_of_office'];

/** Creates a calendar event, or edits one: title, kind, all-day or timed, start and end. */
export function EventModal({ onClose, onDelete, state }: EventModalProps) {
	return (
		<Modal.Root onOpenChange={open => !open && onClose()} open={state !== undefined}>
			<Modal.Content aria-labelledby='event-modal-title' className='max-w-md rounded-2xl p-0'>
				{state && <EventForm key={state.kind === 'edit' ? state.event.id : `new-${state.date}-${state.startMinute}`} onClose={onClose} onDelete={onDelete} state={state} />}
			</Modal.Content>
		</Modal.Root>
	);
}

/** Initial values of the form, in the user's time zone. */
function initialValues(state: EventModalState, timeZone: string | undefined) {
	if (state.kind === 'create') {
		const end = Math.min(state.startMinute + 60, 1439);
		return {
			allDay: state.allDay ?? false,
			endDate: state.date,
			endTime: toTimeValue(end),
			kind: 'event' as EventKind,
			startDate: state.date,
			startTime: toTimeValue(state.startMinute),
			title: '',
		};
	}
	const { allDay, endsAt, kind, startsAt, title } = state.event;
	const start = new Date(startsAt);
	const end = new Date(endsAt);
	return {
		allDay,
		// An all-day event ends at the midnight after its last day, so the last day is the millisecond before.
		endDate: todayInZone(timeZone, 0, allDay ? new Date(end.getTime() - 1) : end),
		endTime: toTimeValue(minuteInZone(end, timeZone)),
		kind,
		startDate: todayInZone(timeZone, 0, start),
		startTime: toTimeValue(minuteInZone(start, timeZone)),
		title,
	};
}

function EventForm({ onClose, onDelete, state }: { onClose: () => void; onDelete: EventModalProps['onDelete']; state: EventModalState }) {
	const t = useTranslate();
	const { timeZone, toApi } = useDateTime();
	const editing = state.kind === 'edit';
	const initial = initialValues(state, timeZone);
	const [title, setTitle] = useState(initial.title);
	const [kind, setKind] = useState<EventKind>(initial.kind);
	const [allDay, setAllDay] = useState(initial.allDay);
	const [startDate, setStartDate] = useState(initial.startDate);
	const [startTime, setStartTime] = useState(initial.startTime);
	const [endDate, setEndDate] = useState(initial.endDate);
	const [endTime, setEndTime] = useState(initial.endTime);

	const create = useCreateEvent();
	const update = useUpdateEvent();
	const pending = create.isPending || update.isPending;

	const startMinute = fromTimeValue(startTime);
	const endMinute = fromTimeValue(endTime);
	const startsAt = startMinute === null || !startDate ? null : toApi(startDate, startMinute);
	const endsAt = endMinute === null || !endDate ? null : toApi(endDate, endMinute);
	const rangeValid = allDay ? Boolean(startDate && endDate && endDate >= startDate) : Boolean(startsAt && endsAt && endsAt > startsAt);
	const valid = title.trim() !== '' && rangeValid;

	const submit = () => {
		if (!valid) return;
		const input: EventInput = allDay
			? { allDay: true, endDate, kind, startDate, title: title.trim() }
			: { allDay: false, endsAt: endsAt ?? '', kind, startsAt: startsAt ?? '', title: title.trim() };
		const options = { onError: (error: unknown) => toast.error(getApiErrorMessage(error)), onSuccess: onClose };
		if (state.kind === 'edit') update.mutate({ id: state.event.id, ...input }, options);
		else create.mutate(input, options);
	};

	return (
		<>
			<Modal.Header className='px-6 pt-6'>
				<Modal.Title id='event-modal-title'>{editing ? t('calendar.event.editTitle') : t('calendar.event.newTitle')}</Modal.Title>
				<Modal.Description>{t('calendar.event.description')}</Modal.Description>
			</Modal.Header>
			<Modal.Body className='px-6 py-4'>
				<Layout.Stack gap='md'>
					<Input className={listStyles.field} maxLength={200}>
						<Input.Label>{t('calendar.event.titleLabel')}</Input.Label>
						<Input.Field autoComplete='off' autoFocus onChange={event => setTitle(event.target.value)} placeholder={t('calendar.event.titlePlaceholder')} value={title} />
					</Input>
					<Select.Root onChange={next => setKind(next as EventKind)} value={kind}>
						<Select.Label>{t('calendar.event.kind')}</Select.Label>
						<Select.Trigger className={listStyles.pillTrigger}>
							<Select.Value />
						</Select.Trigger>
						<Select.Content>
							<Select.ItemList>
								{KINDS.map(option => (
									<Select.Item key={option} value={option}>
										{t(`calendar.kind.${option}`)}
									</Select.Item>
								))}
							</Select.ItemList>
						</Select.Content>
					</Select.Root>
					<Switch checked={allDay} onCheckedChange={setAllDay}>
						<Switch.Label>{t('calendar.event.allDay')}</Switch.Label>
						<Switch.Toggle />
					</Switch>
					<Layout.Grid cols={{ base: 1, md: allDay ? 1 : 2 }} gap='md'>
						<Input className={listStyles.field}>
							<Input.Label>{t('calendar.event.startDate')}</Input.Label>
							<Input.Field onChange={event => setStartDate(event.target.value)} type='date' value={startDate} />
						</Input>
						{!allDay && (
							<Input className={listStyles.field}>
								<Input.Label>{t('calendar.event.startTime')}</Input.Label>
								<Input.Field onChange={event => setStartTime(event.target.value)} type='time' value={startTime} />
							</Input>
						)}
						<Input className={listStyles.field}>
							<Input.Label>{t('calendar.event.endDate')}</Input.Label>
							<Input.Field onChange={event => setEndDate(event.target.value)} type='date' value={endDate} />
						</Input>
						{!allDay && (
							<Input className={listStyles.field}>
								<Input.Label>{t('calendar.event.endTime')}</Input.Label>
								<Input.Field onChange={event => setEndTime(event.target.value)} type='time' value={endTime} />
							</Input>
						)}
					</Layout.Grid>
					{!rangeValid && <p className='text-xs text-destructive'>{t('calendar.event.endBeforeStart')}</p>}
				</Layout.Stack>
			</Modal.Body>
			<Modal.Footer className='px-6 pb-6'>
				<Layout.HStack gap='sm' justify='between'>
					<div>
						{state.kind === 'edit' && (
							<Button disabled={pending} onClick={() => onDelete(state.event)} type='button' variant='destructive'>
								<Button.Text>{t('calendar.event.delete')}</Button.Text>
							</Button>
						)}
					</div>
					<Layout.HStack gap='sm'>
						<Button onClick={onClose} type='button' variant='ghost'>
							<Button.Text>{t('calendar.event.cancel')}</Button.Text>
						</Button>
						<Button disabled={!valid || pending} onClick={submit} type='button'>
							<Button.Text>{editing ? t('calendar.event.save') : t('calendar.event.create')}</Button.Text>
						</Button>
					</Layout.HStack>
				</Layout.HStack>
			</Modal.Footer>
		</>
	);
}
