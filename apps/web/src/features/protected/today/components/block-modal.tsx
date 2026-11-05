import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/actions-controls/button/button';
import { Combobox } from '~/components/ui/forms-inputs/combobox/combobox';
import { Input } from '~/components/ui/forms-inputs/input/input';
import { Select } from '~/components/ui/forms-inputs/select/select';
import { minutesToTime, TimePicker, type TimePickerLang, toTimeString } from '~/components/ui/forms-inputs/time-picker/time-picker';
import { Layout } from '~/components/ui/layout/layout/layout';
import { Modal } from '~/components/ui/overlays-feedback/modal/modal';
import { cn } from '~/components/ui/utils/tailwind/cn';
import { useRetained } from '~/hooks/use-retained';
import { useTranslate } from '~/hooks/use-translate';
import { listStyles } from '../../shared/styles';
import { useDateTime } from '../../shared/use-datetime';
import { type DayBlock, useCloseBlock, useCreateBlock, useDeleteBlock, useMoveBlock, useOpenTasks } from '../api';
import { DURATIONS, fromTimeValue, MINUTES_PER_DAY, minuteOf, toTimeValue } from '../blocks';

export type BlockModalState = { date: string; kind: 'create'; startMinute: number } | { block: DayBlock; date: string; kind: 'edit'; title: string };

interface BlockModalProps {
	onClose: () => void;
	state: BlockModalState | undefined;
}

/** Creates a block (a task and/or a title, a start and a duration) or edits one that is still planned: new time, done, missed, delete. */
export function BlockModal({ onClose, state }: BlockModalProps) {
	// Keeps the last state while the dialog fades out, so it does not collapse into an empty box mid-animation.
	const shown = useRetained(state);

	return (
		<Modal.Root onOpenChange={open => !open && onClose()} open={state !== undefined}>
			<Modal.Content aria-labelledby='block-modal-title' className='max-w-md rounded-2xl p-0'>
				{shown && <BlockForm key={shown.kind === 'edit' ? shown.block.id : `new-${shown.startMinute}`} onClose={onClose} state={shown} />}
			</Modal.Content>
		</Modal.Root>
	);
}

function BlockForm({ onClose, state }: { onClose: () => void; state: BlockModalState }) {
	const t = useTranslate();
	const { timeZone, toApi } = useDateTime();
	const editing = state.kind === 'edit';
	const block = editing ? state.block : undefined;
	const planned = !editing || block?.status === 'planned';

	const initialStart = block ? minuteOf(state.date, block.plannedStart, timeZone) : state.kind === 'create' ? state.startMinute : 0;
	const initialDuration = block ? Math.max(Math.round((new Date(block.plannedEnd).getTime() - new Date(block.plannedStart).getTime()) / 60_000), 15) : 60;
	const [time, setTime] = useState(toTimeValue(initialStart));
	const [duration, setDuration] = useState(initialDuration);
	const [title, setTitle] = useState('');
	const [taskId, setTaskId] = useState<string | null>(null);
	const [query, setQuery] = useState('');
	const timeLang = useMemo<Partial<TimePickerLang>>(
		() => ({ apply: t('tasks.picker.apply'), clear: t('tasks.picker.clear'), hour: t('notes.reminder.picker.hour'), minute: t('notes.reminder.picker.minute') }),
		[t]
	);

	const open = useOpenTasks();
	const create = useCreateBlock();
	const move = useMoveBlock();
	const close = useCloseBlock();
	const remove = useDeleteBlock();
	const pending = create.isPending || move.isPending || close.isPending || remove.isPending;

	const needle = query.trim().toLowerCase();
	const options = (open.data ?? []).filter(task => task.title.toLowerCase().includes(needle)).slice(0, 8);
	const start = fromTimeValue(time);
	const valid = start !== null && start + duration <= MINUTES_PER_DAY && (editing || taskId !== null || title.trim() !== '');
	const range = () => ({ plannedEnd: toApi(state.date, (start ?? 0) + duration), plannedStart: toApi(state.date, start ?? 0) });

	const done = (key: 'today.toast.blockCreated' | 'today.toast.blockDeleted' | 'today.toast.blockDone' | 'today.toast.blockMissed' | 'today.toast.blockUpdated') => {
		toast.success(t(key));
		onClose();
	};

	const submit = () => {
		if (!valid) return;
		if (block) {
			const unchanged = start === initialStart && duration === initialDuration;
			if (unchanged) return onClose();
			return move.mutate({ id: block.id, ...range() }, { onSuccess: () => done('today.toast.blockUpdated') });
		}
		create.mutate({ ...range(), ...(taskId && { taskId }), ...(title.trim() && { title: title.trim() }) }, { onSuccess: () => done('today.toast.blockCreated') });
	};

	return (
		<>
			<Modal.Header className='px-6 pt-6'>
				<Modal.Title id='block-modal-title'>{editing ? t('today.block.editTitle') : t('today.block.newTitle')}</Modal.Title>
				<Modal.Description>{editing ? state.title : t('today.block.description')}</Modal.Description>
			</Modal.Header>
			<Modal.Body className='px-6 py-4'>
				<Layout.Stack gap='md'>
					{!editing && (
						<>
							<Combobox filter={false} onInputChange={setQuery} onValueChange={next => setTaskId(next ?? null)} value={taskId}>
								<Combobox.Label>{t('today.block.task')}</Combobox.Label>
								<Combobox.Input containerClassName={listStyles.pillInput} placeholder={t('today.block.taskPlaceholder')} />
								<Combobox.Content emptyMessage={t('today.plan.addEmpty')}>
									{options.map(task => (
										<Combobox.Item key={task.id} label={task.title} value={task.id}>
											{task.title}
										</Combobox.Item>
									))}
								</Combobox.Content>
							</Combobox>
							<Input className={listStyles.field} maxLength={200}>
								<Input.Label>{t('today.block.titleLabel')}</Input.Label>
								<Input.Field autoComplete='off' onChange={event => setTitle(event.target.value)} placeholder={t('today.block.titlePlaceholder')} value={title} />
							</Input>
						</>
					)}
					{planned ? (
						<Layout.Grid cols={{ base: 1, md: 2 }} gap='md'>
							<TimePicker.Root
								lang={{ ...timeLang, picker: t('today.block.start') }}
								minuteStep={5}
								onChange={next => next && setTime(toTimeString(next))}
								value={start === null ? null : minutesToTime(start)}
							>
								<TimePicker.Label>{t('today.block.start')}</TimePicker.Label>
								<TimePicker.Trigger className={cn(listStyles.pillTrigger, 'h-auto')} />
								<TimePicker.Content />
							</TimePicker.Root>
							<Select.Root onChange={next => setDuration(Number(next))} value={String(duration)}>
								<Select.Label>{t('today.block.duration')}</Select.Label>
								<Select.Trigger className={listStyles.pillTrigger}>
									<Select.Value />
								</Select.Trigger>
								<Select.Content>
									<Select.ItemList>
										{DURATIONS.map(minutes => (
											<Select.Item key={minutes} value={String(minutes)}>
												{t('today.block.minutes', { count: minutes })}
											</Select.Item>
										))}
									</Select.ItemList>
								</Select.Content>
							</Select.Root>
						</Layout.Grid>
					) : (
						<p className='text-sm text-muted-foreground'>{t(`today.block.status.${(block?.status ?? 'done') as 'done' | 'interrupted' | 'missed' | 'rescheduled'}`)}</p>
					)}
					{block && block.warnings.length > 0 && (
						<ul className='flex flex-col gap-1 text-xs text-warning'>
							{block.warnings.map(warning => (
								<li key={`${warning.code}-${warning.refId ?? ''}`}>{t(`today.block.warning.${warning.code}`)}</li>
							))}
						</ul>
					)}
				</Layout.Stack>
			</Modal.Body>
			<Modal.Footer className='px-6 pb-6'>
				<Layout.HStack gap='sm' justify='between'>
					<Layout.HStack gap='sm'>
						{block && planned && (
							<>
								<Button
									disabled={pending}
									onClick={() => close.mutate({ id: block.id, status: 'done' }, { onSuccess: () => done('today.toast.blockDone') })}
									type='button'
									variant='secondary'
								>
									<Button.Text>{t('today.block.markDone')}</Button.Text>
								</Button>
								<Button
									disabled={pending}
									onClick={() => close.mutate({ id: block.id, status: 'missed' }, { onSuccess: () => done('today.toast.blockMissed') })}
									type='button'
									variant='ghost'
								>
									<Button.Text>{t('today.block.markMissed')}</Button.Text>
								</Button>
								<Button disabled={pending} onClick={() => remove.mutate(block.id, { onSuccess: () => done('today.toast.blockDeleted') })} type='button' variant='destructive'>
									<Button.Text>{t('today.block.delete')}</Button.Text>
								</Button>
							</>
						)}
					</Layout.HStack>
					<Layout.HStack gap='sm'>
						<Button onClick={onClose} type='button' variant='ghost'>
							<Button.Text>{t('today.block.cancel')}</Button.Text>
						</Button>
						{planned && (
							<Button disabled={!valid || pending} onClick={submit} type='button'>
								<Button.Text>{editing ? t('today.block.save') : t('today.block.create')}</Button.Text>
							</Button>
						)}
					</Layout.HStack>
				</Layout.HStack>
			</Modal.Footer>
		</>
	);
}
