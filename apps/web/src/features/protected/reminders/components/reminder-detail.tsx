import { ArrowRight, CalendarDays, CircleCheck, Clock, ExternalLink, X } from 'lucide-react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { Button } from '~/components/ui/actions-controls/button/button';
import { Typography } from '~/components/ui/foundations/typography/typography';
import { cn } from '~/components/ui/utils/tailwind/cn';
import { useLanguage } from '~/hooks/use-language';
import { useTranslate } from '~/hooks/use-translate';
import { listStyles } from '../../shared/styles';
import { type Reminder, reminderType, type TargetInfo, targetId, useDismiss, useSnooze } from '../api';
import { formatDay, formatTime } from '../format';
import { TypeIcon, TypePill } from './reminder-type';
import { SnoozeMenu } from './snooze-menu';

function Detail({ children, label }: { children: React.ReactNode; label: string }) {
	return (
		<div className='flex items-center justify-between gap-4 text-sm'>
			<dt className='text-muted-foreground'>{label}</dt>
			<dd className='flex w-3/5 items-center gap-2'>{children}</dd>
		</div>
	);
}

/** The side panel of one reminder: what it points at, snooze / dismiss and its details. */
export function ReminderDetail({ info, onClose, reminder }: { info: TargetInfo | undefined; onClose: () => void; reminder: Reminder }) {
	const t = useTranslate();
	const { locale } = useLanguage();
	const snooze = useSnooze();
	const dismiss = useDismiss();
	const type = reminderType(reminder);
	const remindAt = new Date(reminder.remindAt);
	const dismissed = reminder.status === 'dismissed';
	const when = `${formatDay(remindAt, locale)} ${t('reminders.row.at')} ${formatTime(remindAt, locale)}`;

	return (
		<aside className={cn(listStyles.card, 'relative flex flex-col gap-5 p-5')}>
			<Button aria-label={t('reminders.detail.close')} className='absolute top-3 right-3 size-8 rounded-full p-0' onClick={onClose} size='icon' variant='ghost'>
				<Button.Icon icon={X} />
			</Button>
			<div className='flex items-start gap-4 pr-8'>
				<TypeIcon type={type} />
				<div className='flex min-w-0 flex-col gap-2'>
					<Typography.H3 className='text-xl font-medium'>{info?.title ?? t(`reminders.type.${type}`)}</Typography.H3>
					<span className='flex items-center gap-2 text-sm text-muted-foreground'>
						<Clock aria-hidden className='size-4' />
						{when}
					</span>
				</div>
			</div>
			{info?.description && <p className='line-clamp-4 text-sm whitespace-pre-line text-muted-foreground'>{info.description}</p>}
			{type === 'note' && (
				<Link
					className='flex items-center justify-center gap-2 rounded-full border border-border bg-foreground/[0.03] px-4 py-3 text-sm hover:bg-foreground/[0.06]'
					to={`/notes?note=${targetId(reminder)}`}
				>
					<ExternalLink aria-hidden className='size-4' />
					{t('reminders.detail.viewNote')}
					<ArrowRight aria-hidden className='size-4' />
				</Link>
			)}
			<section className='flex flex-col gap-3 border-t border-border pt-5'>
				<Typography.H4 className='text-base font-medium'>{t('reminders.actions.title')}</Typography.H4>
				<div className='grid grid-cols-2 gap-3'>
					<SnoozeMenu
						disabled={dismissed}
						loading={snooze.isPending}
						onSnooze={date => snooze.mutate({ id: reminder.id, remindAt: date }, { onSuccess: () => toast.success(t('reminders.toast.snoozed')) })}
					/>
					<Button
						className='w-full justify-center rounded-full py-3'
						disabled={dismissed}
						loading={dismiss.isPending}
						onClick={() => dismiss.mutate([reminder.id], { onSuccess: () => toast.success(t('reminders.toast.dismissed')) })}
						variant='secondary'
					>
						<Button.Icon icon={CircleCheck} />
						<Button.Text>{t('reminders.actions.dismiss')}</Button.Text>
					</Button>
				</div>
			</section>
			<dl className='flex flex-col gap-3 border-t border-border pt-5'>
				<Typography.H4 className='text-base font-medium'>{t('reminders.detail.title')}</Typography.H4>
				<Detail label={t('reminders.detail.type')}>
					<TypePill type={type} />
				</Detail>
				<Detail label={t('reminders.detail.date')}>
					<CalendarDays aria-hidden className='size-4 text-muted-foreground' />
					{formatDay(remindAt, locale)}
				</Detail>
				<Detail label={t('reminders.detail.time')}>
					<Clock aria-hidden className='size-4 text-muted-foreground' />
					{formatTime(remindAt, locale)}
				</Detail>
				<div className='border-t border-border pt-3'>
					<Detail label={t('reminders.detail.created')}>{`${formatDay(new Date(reminder.createdAt), locale)} • ${formatTime(new Date(reminder.createdAt), locale)}`}</Detail>
				</div>
			</dl>
		</aside>
	);
}
