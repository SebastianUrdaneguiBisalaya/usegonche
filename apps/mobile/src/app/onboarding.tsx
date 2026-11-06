import { useTranslation } from 'react-i18next';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { useSignOut } from '@/features/auth/api';

/** Where a signed-in user with the onboarding unfinished lands. Placeholder: the mobile onboarding is #217. */
export default function Onboarding() {
	const { t } = useTranslation();
	const signOut = useSignOut();

	return (
		<Screen>
			<Text accessibilityRole='header' variant='largeTitle'>
				{t('mobile.onboarding.title')}
			</Text>
			<Text tone='secondary'>{t('mobile.onboarding.pending')}</Text>
			<Button loading={signOut.isPending} onPress={() => signOut.mutate()} title={t('protected.settings.logout')} variant='secondary' />
		</Screen>
	);
}
