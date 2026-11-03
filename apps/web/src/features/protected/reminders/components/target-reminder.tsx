import { Bell, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/actions-controls/button/button';
import { DatePicker } from '~/components/ui/forms-inputs/date-picker/date-picker';
import { Icon } from '~/components/ui/foundations/icon/icon';
import { useLanguage } from '~/hooks/use-language';
import { useTranslate } from '~/hooks/use-translate';
import { getApiErrorMessage } from '~/lib/api-error';
import { formatRelativeLong } from '../../shared/relative-time';
import { usePickerLang } from '../../tasks/components/task-pills';
import { useCreateReminder, useDeleteReminder, useRescheduleReminder, useTargetReminder } from '../api';

type Target = { eventId: string } | { noteId: string } | { taskId: string };

/** "Reminder" card of a detail view: when to be reminded about a task or event (one pending reminder at a time). */
export function TargetReminder({ target }: { target: Target }) {
	const t = useTranslate();
	const { locale } = useLanguage();
	const lang = usePickerLang();
	const reminder = useTargetReminder(target);
	const create = useCreateReminder();
	const reschedule = useRescheduleReminder();
	const remove = useDeleteReminder();
	const pending = reminder.data ?? null;
	const fail = (error: unknown) => toast.error(getApiErrorMessage(error));

	const change = (date: Date | null) => {
		if (!date) return;
		if (pending) reschedule.mutate({ id: pending.id, remindAt: date }, { onError: fail, onSuccess: () => toast.success(t('reminders.target.updated')) });
		else create.mutate({ remindAt: date, target }, { onError: fail, onSuccess: () => toast.success(t('reminders.target.set')) });
	};

	return (
		<div className='flex items-center gap-4 rounded-2xl border border-border bg-foreground/[0.03] p-4'>
			<Icon aria-hidden className='text-muted-foreground' icon={Bell} size='lg' />
			<div className='flex min-w-0 flex-1 flex-col'>
				<p className='text-sm font-medium'>{t('reminders.target.title')}</p>
				<p className='truncate text-xs text-muted-foreground'>
					{pending ? t('reminders.target.pending', { when: formatRelativeLong(pending.remindAt, locale) }) : t('reminders.target.description')}
				</p>
			</div>
			<DatePicker.Root granularity='minute' lang={lang} locale={locale} minDate={new Date()} minuteStep={5} onChange={change} value={pending ? new Date(pending.remindAt) : null}>
				<DatePicker.Trigger
					aria-label={t('reminders.target.change')}
					className='w-fit rounded-full border-border bg-foreground/[0.03] px-4 py-2'
					disabled={reminder.isLoading || reminder.isError}
					placeholder={t('reminders.target.none')}
				/>
				<DatePicker.Content />
			</DatePicker.Root>
			{pending && (
				<Button
					aria-label={t('reminders.target.remove')}
					className='size-8 shrink-0 rounded-full p-0 text-muted-foreground'
					loading={remove.isPending}
					onClick={() => remove.mutate(pending.id, { onError: fail, onSuccess: () => toast.success(t('reminders.target.removed')) })}
					size='icon'
					variant='ghost'
				>
					<Button.Icon icon={X} />
				</Button>
			)}
		</div>
	);
}
