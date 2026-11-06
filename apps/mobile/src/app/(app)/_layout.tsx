import { Stack } from 'expo-router';
import { useColors } from '@/theme';

/** Signed-in, onboarded area. The Today / Capture / Reflect screens of the next mobile issues live here. */
export default function AppLayout() {
	const colors = useColors();
	return (
		<Stack
			screenOptions={{
				contentStyle: { backgroundColor: colors.background },
				headerLargeTitleEnabled: true,
				headerLargeTitleShadowVisible: false,
				headerShadowVisible: false,
				headerStyle: { backgroundColor: colors.background },
				headerTintColor: colors.foreground,
			}}
		/>
	);
}
