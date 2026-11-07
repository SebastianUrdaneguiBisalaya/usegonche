import { useMemo } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/actions-controls/button/button';
import { Combobox } from '~/components/ui/forms-inputs/combobox/combobox';
import { DatePicker } from '~/components/ui/forms-inputs/date-picker/date-picker';
import { Form } from '~/components/ui/forms-inputs/form/form';
import { Input } from '~/components/ui/forms-inputs/input/input';
import { Select } from '~/components/ui/forms-inputs/select/select';
import { Layout } from '~/components/ui/layout/layout/layout';
import { Modal } from '~/components/ui/overlays-feedback/modal/modal';
import { cn } from '~/components/ui/utils/tailwind/cn';
import { useLanguage } from '~/hooks/use-language';
import { useTranslate } from '~/hooks/use-translate';
import { fromDateOnly, toDateOnly } from '../../shared/dates';
import { useProjectOptions } from '../../shared/projects';
import { listStyles } from '../../shared/styles';
import { useCreateTag, useTagOptions } from '../../shared/tags';
import { useCreateTask, useGoalOptions } from '../api';
import { createTaskFormSchema, TITLE_MAX } from '../schemas';
import { type TaskPriority, taskPriorities } from '../search-params';
import { usePickerLang } from './task-pills';

const NONE = '__none';

interface NewTaskModalProps {
	onOpenChange: (open: boolean) => void;
	open: boolean;
	/** Status the new task starts in (the column whose "Add task" was pressed). */
	status: 'in_progress' | 'todo';
}

/** "New task": title, description, project, goal, priority, due date and tags (`POST /tasks`). */
export function NewTaskModal({ onOpenChange, open, status }: NewTaskModalProps) {
	const t = useTranslate();
	const { locale } = useLanguage();
	const pickerLang = usePickerLang();
	const create = useCreateTask();
	const projects = useProjectOptions();
	const goals = useGoalOptions();
	const tags = useTagOptions();
	const createTag = useCreateTag();
	const schema = useMemo(() => createTaskFormSchema(t), [t]);

	return (
		<Modal.Root onOpenChange={onOpenChange} open={open}>
			<Modal.Content aria-labelledby='new-task-title' className='max-w-xl rounded-2xl p-0'>
				<Form
					defaultValues={{ description: '', dueDate: '', goalId: '', priority: 'medium' as TaskPriority, projectId: '', status, tagIds: [], title: '' }}
					key={status}
					mode='onSubmit'
					onSubmit={async values => {
						await create.mutateAsync({
							description: values.description || undefined,
							dueDate: values.dueDate || undefined,
							goalId: values.goalId || undefined,
							priority: values.priority,
							projectId: values.projectId || undefined,
							status: values.status,
							tagIds: values.tagIds,
							title: values.title,
						});
						toast.success(t('tasks.toast.created'));
						onOpenChange(false);
					}}
					schema={schema}
				>
					<Modal.Header className='px-6 pt-6'>
						<Modal.Title id='new-task-title'>{t('tasks.modal.title')}</Modal.Title>
						<Modal.Description>{t('tasks.modal.description')}</Modal.Description>
					</Modal.Header>
					<Modal.Body className='max-h-[60vh] overflow-y-auto px-6 py-4'>
						<Layout.Stack gap='md'>
							<Form.Field name='title'>
								{field => (
									<Input className={listStyles.field} errorMessage={field.error} maxLength={TITLE_MAX}>
										<Input.Label required>{t('tasks.form.title.label')}</Input.Label>
										<Input.Field autoComplete='off' placeholder={t('tasks.form.title.placeholder')} {...field.inputProps} />
									</Input>
								)}
							</Form.Field>
							<Form.Field name='description'>
								{field => (
									<Input className={listStyles.field} errorMessage={field.error}>
										<Input.Label>{t('tasks.form.description.label')}</Input.Label>
										<Input.Textarea placeholder={t('tasks.form.description.placeholder')} rows={4} {...field.inputProps} />
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
								<Form.Field name='dueDate'>
									{field => (
										<DatePicker.Root lang={pickerLang} locale={locale} onChange={date => field.onChange(date ? toDateOnly(date) : '')} value={fromDateOnly(field.value as string)}>
											<DatePicker.Label>{t('tasks.form.dueDate.label')}</DatePicker.Label>
											<DatePicker.Trigger className={cn(listStyles.pillTrigger, 'h-auto')} placeholder={t('tasks.form.dueDate.placeholder')} />
											<DatePicker.Content />
										</DatePicker.Root>
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
										<Combobox.Input containerClassName={cn(listStyles.pillInput, 'min-h-[2.625rem] px-4')} placeholder={t('tasks.form.tags.placeholder')} />
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
							<Form.Submit>{t('tasks.form.create')}</Form.Submit>
						</Layout.HStack>
					</Modal.Footer>
				</Form>
			</Modal.Content>
		</Modal.Root>
	);
}
