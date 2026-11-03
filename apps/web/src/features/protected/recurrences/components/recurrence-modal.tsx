import { useMemo } from 'react';
import { useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '~/components/ui/actions-controls/button/button';
import { ToggleGroup } from '~/components/ui/actions-controls/toggle-group/toggle-group';
import { Combobox } from '~/components/ui/forms-inputs/combobox/combobox';
import { DatePicker } from '~/components/ui/forms-inputs/date-picker/date-picker';
import { Form } from '~/components/ui/forms-inputs/form/form';
import { Input } from '~/components/ui/forms-inputs/input/input';
import { Select } from '~/components/ui/forms-inputs/select/select';
import { Layout } from '~/components/ui/layout/layout/layout';
import { Modal } from '~/components/ui/overlays-feedback/modal/modal';
import { useLanguage } from '~/hooks/use-language';
import { useTranslate } from '~/hooks/use-translate';
import { getApiErrorMessage } from '~/lib/api-error';
import { apiDateOnly, fromDateOnly, toDateOnly } from '../../shared/dates';
import { useProjectOptions } from '../../shared/projects';
import { listStyles } from '../../shared/styles';
import { useCreateTag, useTagOptions } from '../../shared/tags';
import { useDateTime } from '../../shared/use-datetime';
import { useGoalOptions } from '../../tasks/api';
import { usePickerLang } from '../../tasks/components/task-pills';
import { type TaskPriority, taskPriorities } from '../../tasks/search-params';
import { type Recurrence, useCreateRecurrence, useUpdateRecurrence } from '../api';
import { buildRule, type Frequency, frequencies, minuteToTime, parseRule, timeToMinute, type Weekday, weekdays } from '../rule';
import { recurrenceFormSchema, TITLE_MAX } from '../schemas';

const NONE = '__none';

/** What a new rule starts with, e.g. the fields of the task it is made from. */
export interface RecurrencePrefill {
	description?: string | null;
	estimatedMinutes?: number | null;
	goalId?: string | null;
	priority?: TaskPriority;
	projectId?: string | null;
	tagIds?: string[];
	title?: string;
}

interface RecurrenceModalProps {
	onOpenChange: (open: boolean) => void;
	open: boolean;
	prefill?: RecurrencePrefill;
	/** The rule to edit; without it the modal creates one. */
	recurrence?: Recurrence;
}

/** The weekdays of a weekly rule (nothing is shown for the other frequencies). */
function WeekdaysField({ locale }: { locale: string }) {
	const t = useTranslate();
	const freq = useWatch({ name: 'freq' });
	if (freq !== 'WEEKLY') return null;
	return (
		<Form.Field name='byDay'>
			{field => (
				<div className='flex flex-col gap-2'>
					<span className='text-sm text-muted-foreground'>{t('recurrences.form.byDay.label')}</span>
					<ToggleGroup className='flex flex-wrap gap-1' onValueChange={next => field.onChange(next)} type='multiple' value={field.value as string[]} variant='outline'>
						{weekdays.map((day, index) => (
							<ToggleGroup.Item className='rounded-full' key={day} value={day}>
								{new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2024, 0, 1 + index))}
							</ToggleGroup.Item>
						))}
					</ToggleGroup>
				</div>
			)}
		</Form.Field>
	);
}

function initialValues(recurrence: Recurrence | undefined, prefill: RecurrencePrefill | undefined, today: string) {
	const parts = recurrence ? parseRule(recurrence.rule) : null;
	return {
		byDay: (parts?.byDay ?? []) as Weekday[],
		description: recurrence ? (recurrence.description ?? '') : (prefill?.description ?? ''),
		duration: recurrence?.durationMinutes ? String(recurrence.durationMinutes) : '',
		estimate: (recurrence ? recurrence.estimatedMinutes : prefill?.estimatedMinutes) ? String(recurrence ? recurrence.estimatedMinutes : prefill?.estimatedMinutes) : '',
		freq: (parts?.freq ?? 'DAILY') as Frequency,
		goalId: (recurrence ? recurrence.goalId : prefill?.goalId) ?? '',
		interval: String(parts?.interval ?? 1),
		priority: (recurrence?.priority ?? prefill?.priority ?? 'medium') as TaskPriority,
		projectId: (recurrence ? recurrence.projectId : prefill?.projectId) ?? '',
		startDate: recurrence ? apiDateOnly(recurrence.startDate) : today,
		tagIds: recurrence ? recurrence.tags.map(tag => tag.id) : (prefill?.tagIds ?? []),
		time: minuteToTime(recurrence?.startMinute ?? null),
		title: recurrence?.title ?? prefill?.title ?? '',
	};
}

/** "New recurrence" / "Edit recurrence": what to repeat and when (`POST` / `PATCH /recurrences`). Editing applies to the future occurrences that are still untouched. */
export function RecurrenceModal({ onOpenChange, open, prefill, recurrence }: RecurrenceModalProps) {
	const t = useTranslate();
	const { locale } = useLanguage();
	const pickerLang = usePickerLang();
	const { today } = useDateTime();
	const create = useCreateRecurrence();
	const update = useUpdateRecurrence();
	const projects = useProjectOptions();
	const goals = useGoalOptions();
	const tags = useTagOptions();
	const createTag = useCreateTag();
	const schema = useMemo(() => recurrenceFormSchema(t), [t]);
	const editing = recurrence !== undefined;
	const rest = recurrence ? (parseRule(recurrence.rule)?.rest ?? []) : [];

	return (
		<Modal.Root onOpenChange={onOpenChange} open={open}>
			<Modal.Content aria-labelledby='recurrence-title' className='max-w-xl rounded-2xl p-0'>
				<Form
					defaultValues={initialValues(recurrence, prefill, today())}
					key={`${recurrence?.id ?? 'new'}:${open}`}
					mode='onSubmit'
					onSubmit={async values => {
						const rule = buildRule({ byDay: values.byDay, freq: values.freq, interval: Number(values.interval), rest });
						const startMinute = timeToMinute(values.time);
						const durationMinutes = values.duration === '' ? null : Number(values.duration);
						const estimatedMinutes = values.estimate === '' ? null : Number(values.estimate);
						try {
							if (recurrence) {
								await update.mutateAsync({
									changes: {
										description: values.description || null,
										durationMinutes: startMinute === null ? null : durationMinutes,
										estimatedMinutes,
										goalId: values.goalId || null,
										priority: values.priority,
										projectId: values.projectId || null,
										rule,
										startDate: values.startDate,
										startMinute,
										tagIds: values.tagIds,
										title: values.title,
									},
									id: recurrence.id,
								});
								toast.success(t('recurrences.toast.updated'));
							} else {
								await create.mutateAsync({
									description: values.description || undefined,
									durationMinutes: startMinute === null ? undefined : (durationMinutes ?? undefined),
									estimatedMinutes: estimatedMinutes ?? undefined,
									goalId: values.goalId || undefined,
									priority: values.priority,
									projectId: values.projectId || undefined,
									rule,
									startDate: values.startDate,
									startMinute: startMinute ?? undefined,
									tagIds: values.tagIds,
									title: values.title,
								});
								toast.success(t('recurrences.toast.created'));
							}
							onOpenChange(false);
						} catch (error) {
							toast.error(getApiErrorMessage(error));
						}
					}}
					schema={schema}
				>
					<Modal.Header className='px-6 pt-6'>
						<Modal.Title id='recurrence-title'>{t(editing ? 'recurrences.modal.editTitle' : 'recurrences.modal.title')}</Modal.Title>
						<Modal.Description>{t(editing ? 'recurrences.modal.editDescription' : 'recurrences.modal.description')}</Modal.Description>
					</Modal.Header>
					<Modal.Body className='max-h-[60vh] overflow-y-auto px-6 py-4'>
						<Layout.Stack gap='md'>
							<Form.Field name='title'>
								{field => (
									<Input className={listStyles.field} errorMessage={field.error} maxLength={TITLE_MAX}>
										<Input.Label>{t('recurrences.form.title.label')}</Input.Label>
										<Input.Field autoComplete='off' placeholder={t('recurrences.form.title.placeholder')} {...field.inputProps} />
									</Input>
								)}
							</Form.Field>
							<Layout.Grid cols={{ base: 1, sm: 2 }} gap='md'>
								<Form.Field name='freq'>
									{field => (
										<Select.Root onChange={field.onChange} value={field.value as string}>
											<Select.Label>{t('recurrences.form.freq.label')}</Select.Label>
											<Select.Trigger className={listStyles.pillTrigger}>
												<Select.Value />
											</Select.Trigger>
											<Select.Content>
												<Select.ItemList>
													{frequencies.map(freq => (
														<Select.Item key={freq} value={freq}>
															{t(`recurrences.form.freq.${freq}`)}
														</Select.Item>
													))}
												</Select.ItemList>
											</Select.Content>
										</Select.Root>
									)}
								</Form.Field>
								<Form.Field name='interval'>
									{field => (
										<Input className={listStyles.field} errorMessage={field.error}>
											<Input.Label>{t('recurrences.form.interval.label')}</Input.Label>
											<Input.Field inputMode='numeric' {...field.inputProps} />
										</Input>
									)}
								</Form.Field>
							</Layout.Grid>
							<WeekdaysField locale={locale} />
							<Layout.Grid cols={{ base: 1, sm: 3 }} gap='md'>
								<Form.Field name='startDate'>
									{field => (
										<DatePicker.Root lang={pickerLang} locale={locale} onChange={date => field.onChange(date ? toDateOnly(date) : '')} value={fromDateOnly(field.value as string)}>
											<DatePicker.Label>{t('recurrences.form.startDate.label')}</DatePicker.Label>
											<DatePicker.Trigger className={`${listStyles.pillTrigger} h-auto`} placeholder={t('recurrences.form.startDate.placeholder')} />
											<DatePicker.Content />
										</DatePicker.Root>
									)}
								</Form.Field>
								<Form.Field name='time'>
									{field => (
										<Input className={listStyles.field}>
											<Input.Label>{t('recurrences.form.time.label')}</Input.Label>
											<Input.Field type='time' {...field.inputProps} />
										</Input>
									)}
								</Form.Field>
								<Form.Field name='duration'>
									{field => (
										<Input className={listStyles.field} errorMessage={field.error}>
											<Input.Label>{t('recurrences.form.duration.label')}</Input.Label>
											<Input.Field inputMode='numeric' placeholder={t('recurrences.form.duration.placeholder')} {...field.inputProps} />
										</Input>
									)}
								</Form.Field>
							</Layout.Grid>
							<Form.Field name='description'>
								{field => (
									<Input className={listStyles.field} errorMessage={field.error}>
										<Input.Label>{t('recurrences.form.description.label')}</Input.Label>
										<Input.Textarea placeholder={t('recurrences.form.description.placeholder')} rows={3} {...field.inputProps} />
									</Input>
								)}
							</Form.Field>
							<Layout.Grid cols={{ base: 1, sm: 2 }} gap='md'>
								<Form.Field name='priority'>
									{field => (
										<Select.Root onChange={field.onChange} value={field.value as string}>
											<Select.Label>{t('tasks.form.priority.label')}</Select.Label>
											<Select.Trigger className={listStyles.pillTrigger}>
												<Select.Value />
											</Select.Trigger>
											<Select.Content>
												<Select.ItemList>
													{taskPriorities.map(priority => (
														<Select.Item key={priority} value={priority}>
															{t(`tasks.priority.${priority}`)}
														</Select.Item>
													))}
												</Select.ItemList>
											</Select.Content>
										</Select.Root>
									)}
								</Form.Field>
								<Form.Field name='estimate'>
									{field => (
										<Input className={listStyles.field}>
											<Input.Label>{t('recurrences.form.estimate.label')}</Input.Label>
											<Input.Field inputMode='numeric' placeholder={t('tasks.properties.minutes')} {...field.inputProps} />
										</Input>
									)}
								</Form.Field>
								<Form.Field name='projectId'>
									{field => (
										<Select.Root onChange={next => field.onChange(next === NONE ? '' : next)} value={(field.value as string) || NONE}>
											<Select.Label>{t('tasks.form.project.label')}</Select.Label>
											<Select.Trigger className={listStyles.pillTrigger}>
												<Select.Value />
											</Select.Trigger>
											<Select.Content>
												<Select.ItemList>
													<Select.Item value={NONE}>{t('tasks.form.project.none')}</Select.Item>
													{(projects.data ?? []).map(project => (
														<Select.Item key={project.id} value={project.id}>
															{project.title}
														</Select.Item>
													))}
												</Select.ItemList>
											</Select.Content>
										</Select.Root>
									)}
								</Form.Field>
								<Form.Field name='goalId'>
									{field => (
										<Select.Root onChange={next => field.onChange(next === NONE ? '' : next)} value={(field.value as string) || NONE}>
											<Select.Label>{t('tasks.form.goal.label')}</Select.Label>
											<Select.Trigger className={listStyles.pillTrigger}>
												<Select.Value />
											</Select.Trigger>
											<Select.Content>
												<Select.ItemList>
													<Select.Item value={NONE}>{t('tasks.form.goal.none')}</Select.Item>
													{(goals.data ?? []).map(goal => (
														<Select.Item key={goal.id} value={goal.id}>
															{goal.title}
														</Select.Item>
													))}
												</Select.ItemList>
											</Select.Content>
										</Select.Root>
									)}
								</Form.Field>
							</Layout.Grid>
							<Form.Field name='tagIds'>
								{field => (
									<Combobox
										multiple
										onCreate={name => createTag.mutate({ name }, { onSuccess: tag => field.onChange([...(field.value as string[]), tag.id]) })}
										onValueChange={field.onChange}
										value={field.value as string[]}
									>
										<Combobox.Label>{t('tasks.form.tags.label')}</Combobox.Label>
										<Combobox.Input containerClassName={listStyles.field} placeholder={t('tasks.form.tags.placeholder')} />
										<Combobox.Content createLabel={name => t('tasks.form.tags.create', { name })} emptyMessage={t('tasks.form.tags.empty')}>
											{(tags.data ?? []).map(tag => (
												<Combobox.Item key={tag.id} label={tag.name} value={tag.id}>
													{tag.name}
												</Combobox.Item>
											))}
										</Combobox.Content>
									</Combobox>
								)}
							</Form.Field>
						</Layout.Stack>
					</Modal.Body>
					<Modal.Footer className='px-6 pb-6'>
						<Layout.HStack gap='sm' justify='end'>
							<Button onClick={() => onOpenChange(false)} type='button' variant='ghost'>
								<Button.Text>{t('tasks.form.cancel')}</Button.Text>
							</Button>
							<Form.Submit>{t(editing ? 'recurrences.form.save' : 'recurrences.form.create')}</Form.Submit>
						</Layout.HStack>
					</Modal.Footer>
				</Form>
			</Modal.Content>
		</Modal.Root>
	);
}
