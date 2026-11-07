import { Button } from '~/components/ui/actions-controls/button/button';
import { ConfirmDialog } from '~/components/ui/overlays-feedback/confirm-dialog/confirm-dialog';
import { SettingsDialog } from '~/components/ui/overlays-feedback/settings-dialog/settings-dialog';
import { useTranslate } from '~/hooks/use-translate';
import { useDeleteAccount } from './api';

/** "Danger zone" of the account settings: deletes the account and every piece of data in it, after a confirmation. */
export function DangerZone() {
	const t = useTranslate();
	const remove = useDeleteAccount();

	return (
		<SettingsDialog.Section title={t('protected.settings.account.danger.title')}>
			<SettingsDialog.Row description={t('protected.settings.account.danger.description')} label={t('protected.settings.account.danger.label')}>
				<ConfirmDialog.Root
					lang={{ cancel: t('protected.settings.account.danger.cancel'), confirm: t('protected.settings.account.danger.confirm') }}
					onConfirm={async () => {
						await remove.mutateAsync();
						// A full load: the session cookie is gone and nothing of the old account may stay in memory.
						window.location.assign('/auth/sign-in');
					}}
					variant='destructive'
				>
					<ConfirmDialog.Trigger>
						<Button variant='destructive'>
							<Button.Text>{t('protected.settings.account.danger.button')}</Button.Text>
						</Button>
					</ConfirmDialog.Trigger>
					<ConfirmDialog.Content>
						<ConfirmDialog.Title>{t('protected.settings.account.danger.confirmTitle')}</ConfirmDialog.Title>
						<ConfirmDialog.Description>{t('protected.settings.account.danger.confirmDescription')}</ConfirmDialog.Description>
						<ConfirmDialog.Footer>
							<ConfirmDialog.Cancel />
							<ConfirmDialog.Confirm />
						</ConfirmDialog.Footer>
					</ConfirmDialog.Content>
				</ConfirmDialog.Root>
			</SettingsDialog.Row>
		</SettingsDialog.Section>
	);
}
