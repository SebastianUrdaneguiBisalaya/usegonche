import { CalendarClock, Keyboard, SlidersHorizontal, UserRound } from 'lucide-react';
import { SettingsDialog } from '~/components/ui/overlays-feedback/settings-dialog/settings-dialog';
import { useTranslate } from '~/hooks/use-translate';
import { AccountPanel } from './account-panel';
import { AvailabilityPanel } from './availability-panel';
import { GeneralPanel } from './general-panel';
import { ShortcutsPanel } from './shortcuts-panel';

/** Navigation and panels of the settings dialog: one "Settings" group with General, Account and Shortcuts. */
export function SettingsContent() {
	const t = useTranslate();

	return (
		<SettingsDialog.Content title={t('protected.settings.title')}>
			<SettingsDialog.Sidebar>
				<SettingsDialog.Search />
				<SettingsDialog.Nav>
					<SettingsDialog.Group label={t('protected.settings.group')}>
						<SettingsDialog.Item icon={SlidersHorizontal} keywords={['theme', 'language', 'country', 'tema', 'idioma', 'país']} value='general'>
							{t('protected.settings.general.nav')}
						</SettingsDialog.Item>
						<SettingsDialog.Item icon={UserRound} keywords={['profile', 'email', 'avatar', 'perfil', 'cuenta']} value='account'>
							{t('protected.settings.account.nav')}
						</SettingsDialog.Item>
						<SettingsDialog.Item icon={CalendarClock} keywords={['availability', 'working hours', 'schedule', 'disponibilidad', 'horario', 'trabajo']} value='availability'>
							{t('protected.settings.availability.nav')}
						</SettingsDialog.Item>
						<SettingsDialog.Item icon={Keyboard} keywords={['hotkeys', 'keyboard', 'atajos', 'teclado']} value='shortcuts'>
							{t('protected.settings.shortcuts.nav')}
						</SettingsDialog.Item>
					</SettingsDialog.Group>
				</SettingsDialog.Nav>
			</SettingsDialog.Sidebar>
			<SettingsDialog.Main>
				<SettingsDialog.Panel value='general'>
					<GeneralPanel />
				</SettingsDialog.Panel>
				<SettingsDialog.Panel value='account'>
					<AccountPanel />
				</SettingsDialog.Panel>
				<SettingsDialog.Panel value='availability'>
					<AvailabilityPanel />
				</SettingsDialog.Panel>
				<SettingsDialog.Panel value='shortcuts'>
					<ShortcutsPanel />
				</SettingsDialog.Panel>
			</SettingsDialog.Main>
		</SettingsDialog.Content>
	);
}
