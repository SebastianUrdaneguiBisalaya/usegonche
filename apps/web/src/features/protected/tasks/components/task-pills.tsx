import { OctagonAlert } from 'lucide-react';
import { useMemo } from 'react';
import { Pill } from '~/components/ui/data-display/pill/pill';
import { DatePicker, type DatePickerLang } from '~/components/ui/forms-inputs/date-picker/date-picker';
import { cn } from '~/components/ui/utils/tailwind/cn';
import { useLanguage } from '~/hooks/use-language';
import { useTranslate } from '~/hooks/use-translate';
import { apiDateOnly, fromDateOnly, toDateOnly } from '../../shared/dates';
import { StatusMenu } from '../../shared/status-pill';
import { useDateTime } from '../../shared/use-datetime';
import { daysUntil, isOpen, priorityClass, priorityDot, statusColor, statusDot, statusIcon } from '../display';
import { type TaskPriority, type TaskStatus, taskPriorities, taskStatuses } from '../search-params';

/** Texts of the date picker, from the `tasks.picker.*` catalog. */
export function usePickerLang(): Partial<DatePickerLang> {
	const t = useTranslate();
	return useMemo(
		() => ({
			apply: t('tasks.picker.apply'),
			calendar: t('tasks.picker.calendar'),
			clear: t('tasks.picker.clear'),
			nextMonth: t('tasks.picker.nextMonth'),
			previousMonth: t('tasks.picker.previousMonth'),
			weekdays: [t('tasks.picker.mo'), t('tasks.picker.tu'), t('tasks.picker.we'), t('tasks.picker.th'), t('tasks.picker.fr'), t('tasks.picker.sa'), t('tasks.picker.su')],
		}),
		[t]
	);
}

/** "Sep 15" in the user's language; a date in another year shows the year. */
export function useFormatDay(): (dateOnly: string) => string {
	const { locale } = useLanguage();
	return useMemo(() => {
		const sameYear = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });
		const otherYear = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' });
		return (dateOnly: string) => {
			const date = fromDateOnly(dateOnly);
			if (!date) return '';
			return (date.getFullYear() === new Date().getFullYear() ? sameYear : otherYear).format(date);
		};
	}, [locale]);
}

/** A priority as a colored pill. */
export function PriorityPill({ priority }: { priority: TaskPriority }) {
	const t = useTranslate();
	return (
		<Pill className={priorityClass[priority]}>
			<Pill.Text>{t(`tasks.priority.${priority}`)}</Pill.Text>
		</Pill>
	);
}

/** The priority pill as a menu: a click changes the value without opening anything else. */
export function PriorityMenu({ onChange, priority, readOnly }: { onChange: (priority: TaskPriority) => void; priority: TaskPriority; readOnly?: boolean }) {
	const t = useTranslate();
	return (
		<StatusMenu
			ariaLabel={t('tasks.priority.change')}
			current={{ dotClassName: priorityDot[priority], label: t(`tasks.priority.${priority}`) }}
			onChange={onChange}
			options={taskPriorities.map(value => ({ dotClassName: priorityDot[value], label: t(`tasks.priority.${value}`), value }))}
			readOnly={readOnly}
			selected={priority}
		/>
	);
}

/** The status pill as a menu. */
export function TaskStatusMenu({ onChange, readOnly, status }: { onChange: (status: TaskStatus) => void; readOnly?: boolean; status: TaskStatus }) {
	const t = useTranslate();
	return (
		<StatusMenu
			ariaLabel={t('tasks.status.change')}
			current={{ icon: statusIcon[status], iconClassName: statusColor[status], label: t(`tasks.status.${status}`) }}
			onChange={onChange}
			options={taskStatuses.map(value => ({ dotClassName: statusDot[value], label: t(`tasks.status.${value}`), value }))}
			readOnly={readOnly}
			selected={status}
		/>
	);
}

/** The red tag of a blocked task. Informational: it never stops any action. */
export function BlockedTag({ openBlockers }: { openBlockers: number }) {
	const t = useTranslate();
	return (
		<Pill title={openBlockers > 0 ? t('tasks.blocked.byBlockers', { count: openBlockers }) : t('tasks.blocked.byDependencies')} variant='destructive'>
			<OctagonAlert aria-hidden className='size-3' />
			<Pill.Text>{t('tasks.blocked.tag')}</Pill.Text>
		</Pill>
	);
}

interface DueDateProps {
	/** Accessible name of the button. */
	ariaLabel?: string;
	className?: string;
	/** Text when there is no date. */
	emptyLabel?: string;
	onChange: (dateOnly: string | null) => void;
	/** Only an open task reads as overdue. */
	status: TaskStatus;
	/** `YYYY-MM-DD`, or empty. */
	value: string;
}

/** The due date as text you click to change: a calendar opens in place. Past dates of open tasks read as overdue. */
export function DueDate({ ariaLabel, className, emptyLabel, onChange, status, value }: DueDateProps) {
	const t = useTranslate();
	const { locale } = useLanguage();
	const lang = usePickerLang();
	const { today } = useDateTime();
	const overdue = value !== '' && isOpen(status) && daysUntil(value, today()) < 0;

	return (
		<DatePicker.Root lang={lang} locale={locale} onChange={date => onChange(date ? toDateOnly(date) : null)} value={fromDateOnly(value)}>
			<DatePicker.Trigger
				aria-label={ariaLabel ?? t('tasks.due.change')}
				className={cn(
					'h-auto w-fit gap-1.5 border-0 bg-transparent px-2 py-1 text-sm shadow-none hover:bg-foreground/[0.06]',
					overdue ? 'text-destructive' : 'text-muted-foreground',
					className ?? ''
				)}
				placeholder={emptyLabel ?? t('tasks.due.none')}
			/>
			<DatePicker.Content />
		</DatePicker.Root>
	);
}

/** `YYYY-MM-DD` of a task's API date. */
export const taskDay = apiDateOnly;
