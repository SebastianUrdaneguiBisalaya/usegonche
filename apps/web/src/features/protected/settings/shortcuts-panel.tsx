import { useBindings } from '@usehotkeys/react';
import { Kbd } from '~/components/ui/foundations/kbd/kbd';
import { SettingsDialog } from '~/components/ui/overlays-feedback/settings-dialog/settings-dialog';
import { useTranslate } from '~/hooks/use-translate';
import { shortcutKeys } from '../shared/shortcut-keys';

const GROUPS = ['general', 'navigation'] as const;

/** Read-only list of every labelled shortcut registered in the app right now (`useBindings`); the user cannot change them. */
export function ShortcutsPanel() {
	const t = useTranslate();
	const bindings = useBindings({ labeledOnly: true });

	const sections = [...GROUPS, undefined]
		.map(group => ({
			group,
			items: bindings.filter(
				(binding, index) =>
					(GROUPS.includes(binding.group as never) ? binding.group === group : group === undefined) &&
					bindings.findIndex(other => other.label === binding.label && other.combos[0] === binding.combos[0]) === index
			),
		}))
		.filter(section => section.items.length > 0);

	if (sections.length === 0) return <p className='font-primary text-sm text-muted-foreground'>{t('protected.settings.shortcuts.empty')}</p>;

	return (
		<>
			<p className='font-primary text-sm text-muted-foreground'>{t('protected.settings.shortcuts.description')}</p>
			{sections.map(({ group, items }) => (
				<SettingsDialog.Section key={group ?? 'other'} title={t(`protected.settings.shortcuts.groups.${group ?? 'other'}`)}>
					{items.map(binding => (
						<SettingsDialog.Row key={binding.id} label={binding.label}>
							<Kbd.Group>
								{shortcutKeys(binding.combos[0] ?? '').map(key => (
									<Kbd key={key}>{key}</Kbd>
								))}
							</Kbd.Group>
						</SettingsDialog.Row>
					))}
				</SettingsDialog.Section>
			))}
		</>
	);
}
