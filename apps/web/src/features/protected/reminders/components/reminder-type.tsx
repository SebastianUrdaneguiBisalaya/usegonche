import { CalendarDays, FileText, ListChecks } from 'lucide-react';
import { Pill } from '~/components/ui/data-display/pill/pill';
import { Icon } from '~/components/ui/foundations/icon/icon';
import { cn } from '~/components/ui/utils/tailwind/cn';
import { useTranslate } from '~/hooks/use-translate';
import type { ReminderType } from '../api';

const icons = { event: CalendarDays, note: FileText, task: ListChecks } as const;
const tones: Record<ReminderType, string> = {
	event: 'border-transparent bg-chart-4/15 text-chart-4',
	note: 'border-transparent bg-chart-2/15 text-chart-2',
	task: 'border-transparent bg-muted text-foreground',
};

/** Round icon of what the reminder points at. */
export function TypeIcon({ muted, type }: { muted?: boolean; type: ReminderType }) {
	return (
		<span
			aria-hidden
			className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', type === 'event' ? 'bg-chart-4/15 text-chart-4' : 'text-muted-foreground', muted ? 'opacity-60' : '')}
		>
			<Icon icon={icons[type]} size='md' />
		</span>
	);
}

/** "Event" / "Task" / "Note" pill. */
export function TypePill({ type }: { type: ReminderType }) {
	const t = useTranslate();
	return (
		<Pill className={tones[type]}>
			<Pill.Text>{t(`reminders.type.${type}`)}</Pill.Text>
		</Pill>
	);
}
