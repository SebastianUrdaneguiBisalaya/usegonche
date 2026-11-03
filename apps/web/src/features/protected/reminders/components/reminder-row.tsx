import { ChevronRight, EllipsisVertical, Trash2 } from 'lucide-react';
import { Checkbox } from '~/components/ui/forms-inputs/checkbox/checkbox';
import { Icon } from '~/components/ui/foundations/icon/icon';
import { Dropdown } from '~/components/ui/overlays-feedback/dropdown/dropdown';
import { useLanguage } from '~/hooks/use-language';
import { useTranslate } from '~/hooks/use-translate';
import { type Reminder, reminderType, type TargetInfo } from '../api';
import { formatDay, formatWhen } from '../format';
import { TypeIcon, TypePill } from './reminder-type';

interface ReminderRowProps {
	checked: boolean;
	info: TargetInfo | undefined;
	onCheckedChange: (checked: boolean) => void;
	onDelete: () => void;
	onDismiss: () => void;
	onOpen: () => void;
	reminder: Reminder;
	selected: boolean;
}

/** One reminder of the list: what it points at, when, and its type. */
export function ReminderRow({ checked, info, onCheckedChange, onDelete, onDismiss, onOpen, reminder, selected }: ReminderRowProps) {
	const t = useTranslate();
	const { locale } = useLanguage();
	const type = reminderType(reminder);
	const remindAt = new Date(reminder.remindAt);
	const dismissed = reminder.status === 'dismissed';
	const snoozed = reminder.status === 'pending' && reminder.snoozeCount > 0;
	const when = snoozed ? t('reminders.row.snoozedUntil', { date: formatDay(remindAt, locale) }) : formatWhen(remindAt, locale, t('reminders.row.at'));
	const priority = info?.priority && (info.priority === 'high' || info.priority === 'urgent') ? ` • ${t('reminders.row.priority', { priority: t(`tasks.priority.${info.priority}`) })}` : '';
	const title = info?.title ?? t(`reminders.type.${type}`);

	return (
		<li className={`flex items-center gap-3 rounded-2xl border bg-foreground/[0.03] px-4 py-3 ${selected ? 'border-border-strong bg-foreground/[0.06]' : 'border-border'}`}>
			<Checkbox checked={checked} onCheckedChange={onCheckedChange}>
				<Checkbox.Toggle />
				<Checkbox.Label className='sr-only'>{t('reminders.row.select', { title })}</Checkbox.Label>
			</Checkbox>
			<button aria-current={selected} className='flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left' onClick={onOpen} type='button'>
				<TypeIcon muted={dismissed || snoozed} type={type} />
				<span className={`flex min-w-0 flex-1 flex-col ${dismissed || snoozed ? 'text-muted-foreground' : ''}`}>
					<span className='truncate text-sm font-medium'>{title}</span>
					<span className='truncate text-xs text-muted-foreground'>
						{dismissed ? t('reminders.row.dismissed') : when}
						{!dismissed && !snoozed && priority}
					</span>
				</span>
				<TypePill type={type} />
			</button>
			{selected ? (
				<Icon aria-hidden className='text-muted-foreground' icon={ChevronRight} size='sm' />
			) : (
				<Dropdown>
					<Dropdown.Trigger>
						<button
							aria-label={t('reminders.row.menu')}
							className='flex size-8 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground'
							type='button'
						>
							<Icon aria-hidden icon={EllipsisVertical} size='sm' />
						</button>
					</Dropdown.Trigger>
					<Dropdown.Content align='end'>
						{!dismissed && <Dropdown.Item onSelect={onDismiss}>{t('reminders.actions.dismiss')}</Dropdown.Item>}
						<Dropdown.Item onSelect={onDelete} variant='destructive'>
							<Icon aria-hidden icon={Trash2} size='sm' />
							{t('reminders.actions.delete')}
						</Dropdown.Item>
					</Dropdown.Content>
				</Dropdown>
			)}
		</li>
	);
}
