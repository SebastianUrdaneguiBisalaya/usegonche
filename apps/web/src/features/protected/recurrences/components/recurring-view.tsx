import { CalendarClock, Pencil, Repeat, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/actions-controls/button/button';
import { Pill } from '~/components/ui/data-display/pill/pill';
import { Skeleton } from '~/components/ui/foundations/skeleton/skeleton';
import { Typography } from '~/components/ui/foundations/typography/typography';
import { ConfirmDialog } from '~/components/ui/overlays-feedback/confirm-dialog/confirm-dialog';
import { cn } from '~/components/ui/utils/tailwind/cn';
import { useLanguage } from '~/hooks/use-language';
import { useTranslate } from '~/hooks/use-translate';
import { apiDateOnly, fromDateOnly } from '../../shared/dates';
import { listStyles } from '../../shared/styles';
import { priorityClass } from '../../tasks/display';
import { type Recurrence, useDeleteRecurrence, useOccurrences, useRecurrences } from '../api';
import { describeRule, formatMinute } from '../rule';
import { RecurrenceModal } from './recurrence-modal';

/** "Tue, Nov 4". */
function useDay() {
	const { locale } = useLanguage();
	return (dateOnly: string) => {
		const date = fromDateOnly(apiDateOnly(dateOnly));
		return date ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', weekday: 'short' }).format(date) : '';
	};
}

function Upcoming({ recurrenceId }: { recurrenceId: string }) {
	const t = useTranslate();
	const day = useDay();
	const occurrences = useOccurrences(recurrenceId);
	const items = occurrences.data ?? [];
	// The line keeps its place while it loads, so the card does not grow afterwards.
	if (occurrences.isPending) return <Skeleton className='h-6 w-48' />;
	if (occurrences.isError) return null;
	return (
		<div className='flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
			<CalendarClock aria-hidden className='size-4' />
			{items.length === 0 ? (
				t('recurrences.card.noUpcoming')
			) : (
				<>
					{t('recurrences.card.upcoming')}
					{items.map(task => (
						<Pill key={task.id} variant='outline'>
							<Pill.Text>{day(task.occurrenceDate ?? task.dueDate ?? '')}</Pill.Text>
						</Pill>
					))}
				</>
			)}
		</div>
	);
}

function RuleCard({ onDelete, onEdit, rule }: { onDelete: () => void; onEdit: () => void; rule: Recurrence }) {
	const t = useTranslate();
	const { locale } = useLanguage();
	const when = rule.startMinute === null || rule.durationMinutes === null ? null : `${formatMinute(rule.startMinute, locale)} · ${t('recurrences.card.minutes', { count: rule.durationMinutes })}`;

	return (
		<li className={cn(listStyles.card, 'flex flex-col gap-3 p-4')}>
			<div className='flex items-start justify-between gap-3'>
				<div className='flex min-w-0 flex-col gap-1'>
					<Typography.Span className='truncate text-base font-medium' title={rule.title}>
						{rule.title}
					</Typography.Span>
					<Typography.Span className='text-sm text-muted-foreground'>
						{describeRule(rule.rule, t, locale)}
						{when && ` · ${when}`}
					</Typography.Span>
				</div>
				<div className='flex shrink-0 items-center gap-1'>
					<Button aria-label={t('recurrences.card.edit')} className={listStyles.iconButton} onClick={onEdit} size='icon' title={t('recurrences.card.edit')} variant='ghost'>
						<Button.Icon icon={Pencil} />
					</Button>
					<Button aria-label={t('recurrences.card.delete')} className={listStyles.iconButton} onClick={onDelete} size='icon' title={t('recurrences.card.delete')} variant='ghost'>
						<Button.Icon icon={Trash2} />
					</Button>
				</div>
			</div>
			<div className='flex flex-wrap items-center gap-2'>
				<Pill className={priorityClass[rule.priority]}>
					<Pill.Text>{t(`tasks.priority.${rule.priority}`)}</Pill.Text>
				</Pill>
				{rule.tags.map(tag => (
					<Pill key={tag.id} variant='outline'>
						<Pill.Text>{tag.name}</Pill.Text>
					</Pill>
				))}
			</div>
			<Upcoming recurrenceId={rule.id} />
		</li>
	);
}

interface RecurringViewProps {
	creating: boolean;
	onCreatingChange: (creating: boolean) => void;
}

/** The "Recurring" view of Tasks: every rule with how often it repeats and its next occurrences; create, edit and delete them here. */
export function RecurringView({ creating, onCreatingChange }: RecurringViewProps) {
	const t = useTranslate();
	const rules = useRecurrences();
	const remove = useDeleteRecurrence();
	const [editing, setEditing] = useState<Recurrence | undefined>(undefined);
	const [deleting, setDeleting] = useState<Recurrence | undefined>(undefined);
	const items = rules.data?.data ?? [];

	return (
		<>
			{rules.isPending ? (
				<Skeleton className='gap-3' label={t('recurrences.title')}>
					{[0, 1, 2].map(index => (
						<Skeleton.Item className='h-28 w-full rounded-2xl' key={index} />
					))}
				</Skeleton>
			) : rules.isError ? (
				<div className='flex flex-col items-center gap-3 p-10 text-center'>
					<p className='text-sm text-muted-foreground'>{t('recurrences.error.title')}</p>
					<Button onClick={() => void rules.refetch()} variant='secondary'>
						<Button.Text>{t('recurrences.error.retry')}</Button.Text>
					</Button>
				</div>
			) : items.length === 0 ? (
				<div className={cn(listStyles.card, 'flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center')}>
					<Repeat aria-hidden className='size-8 text-muted-foreground' />
					<Typography.Span className='text-base font-medium'>{t('recurrences.empty.title')}</Typography.Span>
					<Typography.Span className='max-w-sm text-sm text-muted-foreground'>{t('recurrences.empty.description')}</Typography.Span>
					<Button onClick={() => onCreatingChange(true)} variant='secondary'>
						<Button.Text>{t('recurrences.new')}</Button.Text>
					</Button>
				</div>
			) : (
				<ul className='flex flex-col gap-3'>
					{items.map(rule => (
						<RuleCard key={rule.id} onDelete={() => setDeleting(rule)} onEdit={() => setEditing(rule)} rule={rule} />
					))}
				</ul>
			)}
			<RecurrenceModal onOpenChange={onCreatingChange} open={creating} />
			<RecurrenceModal onOpenChange={open => !open && setEditing(undefined)} open={editing !== undefined} recurrence={editing} />
			<ConfirmDialog.Root
				lang={{ cancel: t('recurrences.delete.cancel'), confirm: t('recurrences.delete.confirm') }}
				onConfirm={async () => {
					if (!deleting) return;
					try {
						await remove.mutateAsync(deleting.id);
						toast.success(t('recurrences.toast.deleted'));
					} catch {
						// The global mutation handler already toasted the error.
					}
					setDeleting(undefined);
				}}
				onOpenChange={open => !open && setDeleting(undefined)}
				open={deleting !== undefined}
				variant='destructive'
			>
				<ConfirmDialog.Content>
					<ConfirmDialog.Icon icon={Trash2} />
					<ConfirmDialog.Title>{t('recurrences.delete.title')}</ConfirmDialog.Title>
					<ConfirmDialog.Description>{t('recurrences.delete.description', { title: deleting?.title ?? '' })}</ConfirmDialog.Description>
					<ConfirmDialog.Footer>
						<ConfirmDialog.Cancel />
						<ConfirmDialog.Confirm />
					</ConfirmDialog.Footer>
				</ConfirmDialog.Content>
			</ConfirmDialog.Root>
		</>
	);
}
