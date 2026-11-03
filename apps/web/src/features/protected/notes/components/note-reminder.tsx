import { Bell, X } from 'lucide-react';
import { useMemo } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/actions-controls/button/button';
import { DatePicker, type DatePickerLang } from '~/components/ui/forms-inputs/date-picker/date-picker';
import { Icon } from '~/components/ui/foundations/icon/icon';
import { Skeleton } from '~/components/ui/foundations/skeleton/skeleton';
import { useLanguage } from '~/hooks/use-language';
import { useTranslate } from '~/hooks/use-translate';
import { formatRelativeLong } from '../../shared/relative-time';
import { useNoteReminder, useRemoveNoteReminder, useSetNoteReminder } from '../api';

/** The "Reminder" card of the editor: when to be reminded about the note (one pending reminder per note). Create, see, change and remove it here. */
export function NoteReminder({ noteId }: { noteId: string }) {
	const t = useTranslate();
	const { locale } = useLanguage();
	const reminder = useNoteReminder(noteId);
	const set = useSetNoteReminder(noteId);
	const remove = useRemoveNoteReminder(noteId);

	const lang = useMemo<Partial<DatePickerLang>>(
		() => ({
			apply: t('tasks.picker.apply'),
			calendar: t('tasks.picker.calendar'),
			clear: t('tasks.picker.clear'),
			hour: t('notes.reminder.picker.hour'),
			minute: t('notes.reminder.picker.minute'),
			nextMonth: t('tasks.picker.nextMonth'),
			previousMonth: t('tasks.picker.previousMonth'),
			weekdays: [t('tasks.picker.mo'), t('tasks.picker.tu'), t('tasks.picker.we'), t('tasks.picker.th'), t('tasks.picker.fr'), t('tasks.picker.sa'), t('tasks.picker.su')],
		}),
		[t]
	);

	const pending = reminder.data ?? null;
	const value = pending ? new Date(pending.remindAt) : null;

	const handleChange = (date: Date | null) => {
		if (!date) return;
		set.mutate(
			{ id: pending?.id, remindAt: date },
			{ onError: () => toast.error(t('notes.reminder.error')), onSuccess: () => toast.success(t(pending ? 'notes.reminder.toast.updated' : 'notes.reminder.toast.set')) }
		);
	};

	const handleRemove = () => {
		if (!pending) return;
		remove.mutate(pending.id, { onError: () => toast.error(t('notes.reminder.error')), onSuccess: () => toast.success(t('notes.reminder.toast.removed')) });
	};

	return (
		<div className='flex items-center gap-4 rounded-2xl border border-border bg-foreground/[0.03] p-4'>
			<Icon aria-hidden className='text-muted-foreground' icon={Bell} size='lg' />
			<div className='flex min-w-0 flex-1 flex-col'>
				<p className='text-sm font-medium'>{t('notes.reminder.title')}</p>
				{reminder.isLoading ? (
					<Skeleton label={t('notes.reminder.title')}>
						<Skeleton.Item className='h-3 w-40' />
					</Skeleton>
				) : reminder.isError ? (
					<p className='text-xs text-muted-foreground'>
						{t('notes.reminder.loadError')}{' '}
						<button className='cursor-pointer underline' onClick={() => void reminder.refetch()} type='button'>
							{t('notes.reminder.retry')}
						</button>
					</p>
				) : (
					<p className='truncate text-xs text-muted-foreground'>
						{pending ? t('notes.reminder.pending', { when: formatRelativeLong(pending.remindAt, locale) }) : t('notes.reminder.description')}
					</p>
				)}
			</div>
			<DatePicker.Root granularity='minute' lang={lang} locale={locale} minDate={new Date()} minuteStep={5} onChange={handleChange} value={value}>
				<DatePicker.Trigger
					aria-label={t('notes.reminder.change')}
					className='w-fit rounded-full border-border bg-foreground/[0.03] px-4 py-2'
					disabled={reminder.isLoading || reminder.isError}
					placeholder={t('notes.reminder.none')}
				/>
				<DatePicker.Content />
			</DatePicker.Root>
			{pending && (
				<Button
					aria-label={t('notes.reminder.remove')}
					className='size-8 shrink-0 rounded-full p-0 text-muted-foreground'
					loading={remove.isPending}
					onClick={handleRemove}
					size='icon'
					type='button'
					variant='ghost'
				>
					<Button.Icon icon={X} />
				</Button>
			)}
		</div>
	);
}
