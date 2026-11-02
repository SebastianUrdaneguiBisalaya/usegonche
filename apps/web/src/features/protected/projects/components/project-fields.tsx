import { Combobox } from '~/components/ui/forms-inputs/combobox/combobox';
import { Form } from '~/components/ui/forms-inputs/form/form';
import { Input } from '~/components/ui/forms-inputs/input/input';
import { Select } from '~/components/ui/forms-inputs/select/select';
import { Layout } from '~/components/ui/layout/layout/layout';
import { useTranslate } from '~/hooks/use-translate';
import { listStyles } from '../../shared/styles';
import { useCreateTag, useGoals, useTags } from '../api';
import { displayStatus } from '../display';
import { TITLE_MAX } from '../schemas';
import { projectStatuses } from '../search-params';

const NO_GOAL = '__none';

/** The fields of a project, shared by the "New project" modal and the detail drawer. Render inside a `Form` whose schema is `createProjectFormSchema`. */
export function ProjectFields({ withStatus }: { withStatus?: boolean }) {
	const t = useTranslate();
	const goals = useGoals();
	const tags = useTags();
	const createTag = useCreateTag();

	return (
		<Layout.Stack gap='md'>
			<Form.Field name='title'>
				{field => (
					<Input className={listStyles.field} errorMessage={field.error} maxLength={TITLE_MAX}>
						<Input.Label>{t('projects.form.title.label')}</Input.Label>
						<Input.Field autoComplete='off' placeholder={t('projects.form.title.placeholder')} {...field.inputProps} />
					</Input>
				)}
			</Form.Field>
			<Form.Field name='description'>
				{field => (
					<Input className={listStyles.field} errorMessage={field.error}>
						<Input.Label>{t('projects.form.description.label')}</Input.Label>
						<Input.Textarea placeholder={t('projects.form.description.placeholder')} rows={6} {...field.inputProps} />
					</Input>
				)}
			</Form.Field>
			<Form.Field name='goalId'>
				{field => (
					<Select.Root onChange={next => field.onChange(next === NO_GOAL ? '' : next)} value={field.value || NO_GOAL}>
						<Select.Label>{t('projects.form.goal.label')}</Select.Label>
						<Select.Trigger className={listStyles.pillTrigger}>
							<Select.Value placeholder={t('projects.form.goal.placeholder')} />
						</Select.Trigger>
						<Select.Content>
							<Select.ItemList>
								<Select.Item value={NO_GOAL}>{t('projects.form.goal.none')}</Select.Item>
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
			<Form.Field name='tagIds'>
				{field => (
					<Combobox
						multiple
						onCreate={name => createTag.mutate(name, { onSuccess: tag => field.onChange([...(field.value as string[]), tag.id]) })}
						onValueChange={field.onChange}
						value={field.value as string[]}
					>
						<Combobox.Label>{t('projects.form.tags.label')}</Combobox.Label>
						<Combobox.Input containerClassName={listStyles.field} placeholder={t('projects.form.tags.placeholder')} />
						<Combobox.Content createLabel={name => t('projects.form.tags.create', { name })} emptyMessage={t('projects.form.tags.empty')}>
							{(tags.data ?? []).map(tag => (
								<Combobox.Item key={tag.id} label={tag.name} value={tag.id}>
									{tag.name}
								</Combobox.Item>
							))}
						</Combobox.Content>
					</Combobox>
				)}
			</Form.Field>
			{withStatus && (
				<Form.Field name='status'>
					{field => (
						<Select.Root onChange={field.onChange} value={field.value}>
							<Select.Label>{t('projects.form.status.label')}</Select.Label>
							<Select.Trigger className={listStyles.pillTrigger}>
								<Select.Value />
							</Select.Trigger>
							<Select.Content>
								<Select.ItemList>
									{projectStatuses.map(status => (
										<Select.Item key={status} value={status}>
											{t(`projects.status.${displayStatus({ archivedAt: null, status })}`)}
										</Select.Item>
									))}
								</Select.ItemList>
							</Select.Content>
						</Select.Root>
					)}
				</Form.Field>
			)}
		</Layout.Stack>
	);
}
