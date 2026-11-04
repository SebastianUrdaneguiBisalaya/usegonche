import { useMemo } from 'react';
import { DatePicker, type DatePickerLang } from '~/components/ui/forms-inputs/date-picker/date-picker';
import { Form } from '~/components/ui/forms-inputs/form/form';
import { Input } from '~/components/ui/forms-inputs/input/input';
import { Select } from '~/components/ui/forms-inputs/select/select';
import { Layout } from '~/components/ui/layout/layout/layout';
import { cn } from '~/components/ui/utils/tailwind/cn';
import { useLanguage } from '~/hooks/use-language';
import { useTranslate } from '~/hooks/use-translate';
import { fromDateOnly, toDateOnly } from '../../shared/dates';
import { MarkdownField } from '../../shared/markdown-field';
import { listStyles } from '../../shared/styles';
import { TITLE_MAX } from '../schemas';
import { goalStatuses } from '../search-params';

/** The fields of a goal, shared by the "New goal" modal and the detail drawer. Render inside a `Form` whose schema is `createGoalFormSchema`. */
export function GoalFields({ withStatus }: { withStatus?: boolean }) {
	const t = useTranslate();
	const { locale } = useLanguage();
	const pickerLang = useMemo<Partial<DatePickerLang>>(
		() => ({
			apply: t('goals.form.targetDate.picker.apply'),
			calendar: t('goals.form.targetDate.picker.calendar'),
			clear: t('goals.form.targetDate.picker.clear'),
			nextMonth: t('goals.form.targetDate.picker.nextMonth'),
			previousMonth: t('goals.form.targetDate.picker.previousMonth'),
			weekdays: [
				t('goals.form.targetDate.picker.mo'),
				t('goals.form.targetDate.picker.tu'),
				t('goals.form.targetDate.picker.we'),
				t('goals.form.targetDate.picker.th'),
				t('goals.form.targetDate.picker.fr'),
				t('goals.form.targetDate.picker.sa'),
				t('goals.form.targetDate.picker.su'),
			],
		}),
		[t]
	);

	return (
		<Layout.Stack gap='md'>
			<Form.Field name='title'>
				{field => (
					<Input className={listStyles.field} errorMessage={field.error} maxLength={TITLE_MAX}>
						<Input.Label>{t('goals.form.title.label')}</Input.Label>
						<Input.Field autoComplete='off' placeholder={t('goals.form.title.placeholder')} {...field.inputProps} />
					</Input>
				)}
			</Form.Field>
			<Form.Field name='description'>
				{field => (
					<MarkdownField
						error={field.error}
						label={t('goals.form.description.label')}
						onChange={field.onChange}
						placeholder={t('goals.form.description.placeholder')}
						value={field.value as string}
					/>
				)}
			</Form.Field>
			<Form.Field name='targetDate'>
				{field => (
					<DatePicker.Root lang={pickerLang} locale={locale} onChange={date => field.onChange(date ? toDateOnly(date) : '')} value={fromDateOnly(field.value as string)}>
						<DatePicker.Label>{t('goals.form.targetDate.label')}</DatePicker.Label>
						<DatePicker.Trigger className={cn(listStyles.pillTrigger, 'h-auto')} placeholder={t('goals.form.targetDate.placeholder')} />
						<DatePicker.Content />
					</DatePicker.Root>
				)}
			</Form.Field>
			{withStatus && (
				<Form.Field name='status'>
					{field => (
						<Select.Root onChange={field.onChange} value={field.value}>
							<Select.Label>{t('goals.form.status.label')}</Select.Label>
							<Select.Trigger className={listStyles.pillTrigger}>
								<Select.Value />
							</Select.Trigger>
							<Select.Content>
								<Select.ItemList>
									{goalStatuses.map(status => (
										<Select.Item key={status} value={status}>
											{t(`goals.status.${status}`)}
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
