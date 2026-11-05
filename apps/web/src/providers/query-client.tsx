import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { getApiErrorMessage, isNotFound, isSessionExpired } from '~/lib/api-error';

/**
 * Every failed request ends up here. A 401 on a protected endpoint means the session is over
 * (the API refreshes it through its cookies), so: back to sign-in.
 * Anything else is shown as a toast, so screens never handle API errors themselves. A mutation with `meta: { silent: true }` shows its own
 * message instead (e.g. the dependency cycle), so the generic one is skipped.
 */
function handleError(error: Error, id?: string, silent?: boolean) {
	if (isSessionExpired(error)) {
		window.location.assign('/auth/sign-in');
		return;
	}
	if (silent) return;
	toast.error(getApiErrorMessage(error), {
		id,
	});
}

function makeQueryClient() {
	return new QueryClient({
		defaultOptions: {
			mutations: {
				retry: false,
			},
			queries: {
				gcTime: 30 * 60 * 1000,
				networkMode: 'online',
				refetchOnMount: true,
				refetchOnReconnect: true,
				refetchOnWindowFocus: false,
				retry: 1,
				staleTime: 15 * 60 * 1000,
			},
		},
		mutationCache: new MutationCache({
			onError: (error, _variables, _result, mutation) => handleError(error, undefined, Boolean(mutation.meta?.silent)),
		}),
		// One toast per failing resource. A query with `meta: { optional: true }` reads something that may not exist yet, so its 404 is an answer, not a failure.
		queryCache: new QueryCache({
			onError: (error, query) => {
				// `silent` queries (the session check) report their failure through their own state.
				if (query.meta?.silent || (query.meta?.optional && isNotFound(error))) return;
				handleError(error, `query-${String(query.queryKey[0])}`);
			},
		}),
	});
}

let browserQueryClient: QueryClient | undefined;

/**
 * One client per request on the server (a shared one would hand one user's cached data to the next), one for the whole life of the tab in the
 * browser, so every hook and the session-expiry handler share the same cache.
 */
function getQueryClient(): QueryClient {
	if (typeof window === 'undefined') return makeQueryClient();
	browserQueryClient ??= makeQueryClient();
	return browserQueryClient;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
	const [queryClient] = useState(getQueryClient);
	return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
