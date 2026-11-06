import { Stack } from 'expo-router';
import { useColors } from '@/theme';

export const unstable_settings = { initialRouteName: 'sign-in' };

/** Signed-out screens. Sign-in is the root; the rest push over it with a minimal native back button. */
export default function AuthLayout() {
	const colors = useColors();
	return (
		<Stack
			screenOptions={{
				contentStyle: { backgroundColor: colors.background },
				headerBackButtonDisplayMode: 'minimal',
				headerShadowVisible: false,
				headerStyle: { backgroundColor: colors.background },
				headerTintColor: colors.foreground,
				title: '',
			}}
		>
			<Stack.Screen name='sign-in' options={{ headerShown: false }} />
		</Stack>
	);
}
