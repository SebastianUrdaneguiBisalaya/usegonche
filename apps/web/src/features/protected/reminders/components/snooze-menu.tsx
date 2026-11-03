import { Clock } from 'lucide-react';
import { Button } from '~/components/ui/actions-controls/button/button';
import { Dropdown } from '~/components/ui/overlays-feedback/dropdown/dropdown';
import { useLanguage } from '~/hooks/use-language';
import { useTranslate } from '~/hooks/use-translate';
import { formatDay, formatTime, snoozeOptions } from '../format';

/** "Snooze" button: pick when to be reminded again. */
export function SnoozeMenu({ disabled, loading, onSnooze }: { disabled?: boolean; loading?: boolean; onSnooze: (date: Date) => void }) {
	const t = useTranslate();
	const { locale } = useLanguage();
	return (
		<Dropdown>
			<Dropdown.Trigger>
				<Button className='w-full justify-center rounded-full py-3' disabled={disabled} loading={loading} variant='secondary'>
					<Button.Icon icon={Clock} />
					<Button.Text>{t('reminders.actions.snooze')}</Button.Text>
				</Button>
			</Dropdown.Trigger>
			<Dropdown.Content align='start'>
				{snoozeOptions().map(option => (
					<Dropdown.Item key={option.id} onSelect={() => onSnooze(option.date)}>
						{t(`reminders.snooze.${option.id}`, { when: option.id === 'hour' ? formatTime(option.date, locale) : `${formatDay(option.date, locale)}, ${formatTime(option.date, locale)}` })}
					</Dropdown.Item>
				))}
			</Dropdown.Content>
		</Dropdown>
	);
}
