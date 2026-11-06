import { focusManager, onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { addNetworkStateListener } from 'expo-network';
import { type ReactNode, useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { isSessionExpired } from '@/lib/api-error';

/**
 * One cache for the whole app, shared by every hook and by sign-out (which clears it). A 401 already went through the refresh-and-retry of
 * `api.ts`, so it is not retried here: the session is over and the protected routes send the user back to sign-in.
 */
export const queryClient = new QueryClient({
	defaultOptions: {
		mutations: { retry: false },
		queries: {
			gcTime: 30 * 60 * 1000,
			networkMode: 'online',
			refetchOnReconnect: true,
			refetchOnWindowFocus: true,
			retry: (failureCount, error) => !isSessionExpired(error) && failureCount < 1,
			staleTime: 5 * 60 * 1000,
		},
	},
});

// "Window focus" on native is the app coming back to the foreground.
function onAppStateChange(status: AppStateStatus) {
	focusManager.setFocused(status === 'active');
}

// Queries pause while offline and refetch on reconnect.
onlineManager.setEventListener(setOnline => {
	const subscription = addNetworkStateListener(state => setOnline(state.isConnected !== false));
	return () => subscription.remove();
});

export function QueryProvider({ children }: { children: ReactNode }) {
	useEffect(() => {
		const subscription = AppState.addEventListener('change', onAppStateChange);
		return () => subscription.remove();
	}, []);

	return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
