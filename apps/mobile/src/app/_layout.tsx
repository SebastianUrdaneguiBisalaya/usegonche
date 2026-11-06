import '@/i18n';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StartupError } from '@/features/session/startup-error';
import { useAccountSettings, useApplyAccountSettings } from '@/features/session/use-account-settings';
import { useSession } from '@/features/session/use-session';
import { restoreSession } from '@/lib/auth/session';
import { QueryProvider, queryClient } from '@/providers/query-client';
import { useColors } from '@/theme';

// Keep the splash until we know where the user belongs (signed out, onboarding or the app): no wrong screen flashes on a cold start.
void SplashScreen.preventAutoHideAsync();
void restoreSession();

export default function RootLayout() {
	return (
		<SafeAreaProvider>
			<QueryProvider>
				<RootNavigator />
			</QueryProvider>
		</SafeAreaProvider>
	);
}

/**
 * Route groups by session (`Stack.Protected`): signed out -> `(auth)`; signed in with the onboarding unfinished -> `onboarding` (#217);
 * signed in and onboarded -> `(app)`. A screen whose guard is false is unreachable and the router sends the user to the first allowed one.
 */
function RootNavigator() {
	const session = useSession();
	const signedIn = session.status === 'signedIn';
	const settings = useAccountSettings(signedIn);
	const colors = useColors();
	const scheme = useColorScheme();
	useApplyAccountSettings(signedIn ? settings.data : undefined);

	// Signed in, the decision also needs the settings (onboarding). Without them and with an error (e.g. offline), the user can retry.
	const settingsPending = signedIn && settings.data === undefined && !settings.isError;
	const ready = session.status !== 'loading' && !settingsPending;

	useEffect(() => {
		if (ready) void SplashScreen.hideAsync();
	}, [ready]);

	// However the session ended (sign-out, or a refresh token the API rejected), nothing of that account stays cached.
	useEffect(() => {
		if (session.status === 'signedOut') queryClient.clear();
	}, [session.status]);

	if (!ready) return null;
	if (signedIn && settings.data === undefined) return <StartupError onRetry={() => void settings.refetch()} retrying={settings.isFetching} />;

	const onboarded = Boolean(settings.data?.onboardingCompletedAt);

	return (
		<>
			<StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
			<Stack screenOptions={{ contentStyle: { backgroundColor: colors.background }, headerShown: false }}>
				<Stack.Protected guard={signedIn && onboarded}>
					<Stack.Screen name='(app)' />
				</Stack.Protected>
				<Stack.Protected guard={signedIn && !onboarded}>
					<Stack.Screen name='onboarding' />
				</Stack.Protected>
				<Stack.Protected guard={!signedIn}>
					<Stack.Screen name='(auth)' />
				</Stack.Protected>
				<Stack.Screen name='auth/callback' />
			</Stack>
		</>
	);
}
