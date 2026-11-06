import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { useSignOut } from '@/features/auth/api';
import { useSession } from '@/features/session/use-session';
import { fonts } from '@/theme';

/** Landing of the protected area: a placeholder until the Today screen exists. */
export default function Home() {
	const { t } = useTranslation();
	const session = useSession();
	const signOut = useSignOut();
	const email = session.status === 'signedIn' ? session.user?.email : undefined;

	return (
		<>
			<Stack.Screen options={{ headerLargeTitleStyle: { fontFamily: fonts.title }, headerTitleStyle: { fontFamily: fonts.titleSemiBold }, title: t('protected.nav.today') }} />
			<Screen edges={['bottom']}>
				{email ? <Text tone='secondary'>{t('mobile.home.signedInAs', { email })}</Text> : null}
				<Button loading={signOut.isPending} onPress={() => signOut.mutate()} title={t('protected.settings.logout')} variant='secondary' />
			</Screen>
		</>
	);
}
