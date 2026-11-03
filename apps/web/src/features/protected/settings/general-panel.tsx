import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { SwitchTheme } from '~/components/ui/actions-controls/switch-theme/switch-theme';
import { type CountryFlags, CountrySelect } from '~/components/ui/forms-inputs/country-select/country-select';
import { Select } from '~/components/ui/forms-inputs/select/select';
import { Skeleton } from '~/components/ui/foundations/skeleton/skeleton';
import { SettingsDialog } from '~/components/ui/overlays-feedback/settings-dialog/settings-dialog';
import { useTranslate } from '~/hooks/use-translate';
import { getApiErrorMessage } from '~/lib/api-error';
import { listStyles } from '../shared/styles';
import { useUpdateSettings, useUserSettings } from './api';
import { timezoneForCountry } from './timezone';
import { usePreferences } from './use-preferences';

const languages = ['system', 'en', 'es'] as const;

/** Flags are a big chunk of SVGs: they load the first time this panel opens, and the country list works without them meanwhile. */
function useFlags(): CountryFlags | undefined {
	const [flags, setFlags] = useState<CountryFlags>();
	useEffect(() => {
		let active = true;
		void import('country-flag-icons/react/3x2').then(module => active && setFlags(module as unknown as CountryFlags));
		return () => {
			active = false;
		};
	}, []);
	return flags;
}

/** Theme and language apply on this device right away and are saved on the account; the country is saved together with its time zone. */
export function GeneralPanel() {
	const t = useTranslate();
	const { language, locale, setLanguage, setTheme, theme } = usePreferences();
	const flags = useFlags();
	const { data: settings, isLoading } = useUserSettings();
	const update = useUpdateSettings();

	// Shows the chosen country while it saves, instead of flashing the old one back until the answer arrives.
	const country = update.isPending ? (update.variables.country ?? null) : (settings?.country ?? null);

	const changeCountry = (code: string) => {
		update.mutate({ country: code, timezone: timezoneForCountry(code) }, { onError: error => toast.error(getApiErrorMessage(error)) });
	};

	return (
		<SettingsDialog.Section title={t('protected.settings.general.title')}>
			<SettingsDialog.Row description={t('protected.settings.general.theme.description')} label={t('protected.settings.general.theme.label')}>
				<SwitchTheme
					lang={{
						dark: t('protected.settings.general.theme.dark'),
						groupLabel: t('protected.settings.general.theme.label'),
						light: t('protected.settings.general.theme.light'),
						system: t('protected.settings.general.theme.system'),
					}}
					onValueChange={setTheme}
					value={theme}
				/>
			</SettingsDialog.Row>
			<SettingsDialog.Row description={t('protected.settings.general.language.description')} label={t('protected.settings.general.language.label')}>
				<Select.Root className='h-auto w-52' onChange={setLanguage} value={language}>
					<Select.Trigger aria-label={t('protected.settings.general.language.label')} className={listStyles.pillTrigger}>
						<Select.Value />
					</Select.Trigger>
					<Select.Content>
						<Select.ItemList>
							{languages.map(option => (
								<Select.Item key={option} value={option}>
									{t(`protected.settings.general.language.options.${option}`)}
								</Select.Item>
							))}
						</Select.ItemList>
					</Select.Content>
				</Select.Root>
			</SettingsDialog.Row>
			<SettingsDialog.Row
				description={settings?.timezone ? t('protected.settings.general.country.description', { timezone: settings.timezone }) : t('protected.settings.general.country.hint')}
				label={t('protected.settings.general.country.label')}
			>
				{isLoading ? (
					<Skeleton>
						<Skeleton.Item className='h-10 w-52 rounded-full' />
					</Skeleton>
				) : (
					<CountrySelect.Root className='w-52' flags={flags} locale={locale} onChange={changeCountry} value={country}>
						<CountrySelect.Trigger aria-label={t('protected.settings.general.country.label')} className={listStyles.pillTrigger} />
						<CountrySelect.Content width={288} />
					</CountrySelect.Root>
				)}
			</SettingsDialog.Row>
		</SettingsDialog.Section>
	);
}
