import { Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/actions-controls/button/button';
import { minutesToTime, TimePicker, type TimePickerLang, timeToMinutes, toTimeString } from '~/components/ui/forms-inputs/time-picker/time-picker';
import { Skeleton } from '~/components/ui/foundations/skeleton/skeleton';
import { Layout } from '~/components/ui/layout/layout/layout';
import { SettingsDialog } from '~/components/ui/overlays-feedback/settings-dialog/settings-dialog';
import { cn } from '~/components/ui/utils/tailwind/cn';
import { useLanguage } from '~/hooks/use-language';
import { useTranslate } from '~/hooks/use-translate';
import { getApiErrorMessage } from '~/lib/api-error';
import { listStyles } from '../shared/styles';
import { type AvailabilityWindow, useAvailability, useSetAvailability } from './api';
import { DAY_END, type Draft, findErrors, formatTotal, fromTimeValue, sameWindows, toPayload, toTimeValue, WEEKDAYS } from './availability';

let nextKey = 0;
const withKeys = (windows: readonly AvailabilityWindow[]): Draft[] => windows.map(window => ({ ...window, key: `w${nextKey++}` }));

/** The weekly working hours Today's capacity is computed from: several windows per weekday, saved together. */
export function AvailabilityPanel() {
	const t = useTranslate();
	const availability = useAvailability();

	return (
		<SettingsDialog.Section title={t('protected.settings.availability.title')}>
			{availability.isPending ? (
				<Skeleton className='h-40 w-full' />
			) : availability.isError ? (
				<div className='flex flex-col items-start gap-3 py-4'>
					<p className='text-sm text-muted-foreground'>{t('protected.settings.availability.error')}</p>
					<Button onClick={() => void availability.refetch()} variant='secondary'>
						<Button.Text>{t('protected.settings.availability.retry')}</Button.Text>
					</Button>
				</div>
			) : (
				// A saved template reseeds the draft, so the form always starts from what the server has.
				<AvailabilityForm key={JSON.stringify(availability.data.windows)} saved={availability.data.windows} />
			)}
		</SettingsDialog.Section>
	);
}

function AvailabilityForm({ saved }: { saved: AvailabilityWindow[] }) {
	const t = useTranslate();
	const { locale } = useLanguage();
	const timeLang = useMemo<Partial<TimePickerLang>>(
		() => ({ apply: t('tasks.picker.apply'), clear: t('tasks.picker.clear'), hour: t('notes.reminder.picker.hour'), minute: t('notes.reminder.picker.minute') }),
		[t]
	);
	const save = useSetAvailability();
	const [drafts, setDrafts] = useState<Draft[]>(() => withKeys(saved));

	// 2024-01-01 is a Monday, so weekday 1..7 maps to Mon..Sun.
	const dayName = useMemo(() => {
		const format = new Intl.DateTimeFormat(locale, { weekday: 'long' });
		return (weekday: number) => format.format(new Date(2024, 0, weekday));
	}, [locale]);

	const errors = findErrors(drafts);
	const payload = toPayload(drafts);
	const changed = !sameWindows(payload, saved);
	const weeklyMinutes = payload.reduce((total, window) => total + Math.max(window.endMinute - window.startMinute, 0), 0);

	const update = (key: string, changes: Partial<Draft>) => setDrafts(current => current.map(window => (window.key === key ? { ...window, ...changes } : window)));
	const add = (weekday: number) =>
		setDrafts(current => {
			const last = current.filter(window => window.weekday === weekday).reduce((end, window) => Math.max(end, window.endMinute), 0);
			const startMinute = last === 0 ? 9 * 60 : Math.min(last + 60, DAY_END - 60);
			return [...current, { endMinute: Math.min(startMinute + 8 * 60, DAY_END), key: `w${nextKey++}`, startMinute, weekday }];
		});

	return (
		<div className='flex flex-col gap-4 py-4'>
			<p className='text-sm text-muted-foreground'>{t('protected.settings.availability.description')}</p>
			<ul className='flex flex-col divide-y divide-border'>
				{WEEKDAYS.map(weekday => {
					const windows = drafts.filter(window => window.weekday === weekday).sort((a, b) => a.startMinute - b.startMinute);
					return (
						<li className='flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between' key={weekday}>
							<span className='w-32 pt-2 text-sm font-medium capitalize'>{dayName(weekday)}</span>
							<div className='flex flex-1 flex-col gap-2'>
								{windows.length === 0 && <span className='pt-2 text-sm text-muted-foreground'>{t('protected.settings.availability.dayOff')}</span>}
								{windows.map(window => {
									const error = errors.get(window.key);
									return (
										<div className='flex flex-col gap-1' key={window.key}>
											<div className='flex items-center gap-2'>
												<WindowTime
													label={t('protected.settings.availability.start', { day: dayName(weekday) })}
													lang={timeLang}
													minute={window.startMinute}
													onChange={minute => update(window.key, { startMinute: minute })}
												/>
												<span aria-hidden className='text-muted-foreground'>
													–
												</span>
												<WindowTime
													label={t('protected.settings.availability.end', { day: dayName(weekday) })}
													lang={timeLang}
													minute={window.endMinute}
													onChange={minute => update(window.key, { endMinute: minute })}
												/>
												<Button
													aria-label={t('protected.settings.availability.remove')}
													className={listStyles.iconButton}
													onClick={() => setDrafts(current => current.filter(other => other.key !== window.key))}
													variant='ghost'
												>
													<Button.Icon icon={X} />
												</Button>
											</div>
											{error && <span className='text-xs text-destructive'>{t(`protected.settings.availability.error_${error}`)}</span>}
										</div>
									);
								})}
								<Button className='w-fit text-muted-foreground' onClick={() => add(weekday)} variant='ghost'>
									<Button.Icon icon={Plus} />
									<Button.Text>{t('protected.settings.availability.add')}</Button.Text>
								</Button>
							</div>
						</li>
					);
				})}
			</ul>
			<Layout.HStack align='center' justify='between'>
				<span className='text-sm text-muted-foreground'>{t('protected.settings.availability.total', { total: formatTotal(weeklyMinutes) })}</span>
				<Button
					disabled={!changed || errors.size > 0 || save.isPending}
					onClick={() =>
						save.mutate(payload, {
							onError: error => toast.error(getApiErrorMessage(error)),
							onSuccess: () => toast.success(t('protected.settings.availability.saved')),
						})
					}
				>
					<Button.Text>{t('protected.settings.availability.save')}</Button.Text>
				</Button>
			</Layout.HStack>
		</div>
	);
}

/** One end of an availability window, with the app's time picker (no visible label: the row already says which day). */
function WindowTime({ label, lang, minute, onChange }: { label: string; lang: Partial<TimePickerLang>; minute: number; onChange: (minute: number) => void }) {
	return (
		<TimePicker.Root className='w-36' lang={{ ...lang, picker: label }} minuteStep={5} onChange={next => next && onChange(timeToMinutes(next))} value={minutesToTime(minute)}>
			<TimePicker.Label className='sr-only'>{label}</TimePicker.Label>
			<TimePicker.Trigger className={cn(listStyles.pillTrigger, 'h-auto')} />
			<TimePicker.Content />
		</TimePicker.Root>
	);
}
