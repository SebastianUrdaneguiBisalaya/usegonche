import { NuqsAdapter } from 'nuqs/adapters/react-router/v8';
import { I18nextProvider } from 'react-i18next';
import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration, useRouteLoaderData } from 'react-router';
import { Layout as L } from '~/components/ui/layout/layout/layout';
import { ErrorPage } from '~/features/error-page/error-page';
import { defaultLocale, getI18n, localeFromPreference, readLanguagePreference } from '~/i18n';
import { accountPreferences } from '~/lib/account-preferences.server';
import { themeFromRequest } from '~/lib/theme';
import { HotkeysClientProvider } from '~/providers/hotkeys-client';
import { QueryProvider } from '~/providers/query-client';
import { ToasterProvider } from '~/providers/toast-client';
import type { Route } from './+types/root';
import stylesheet from './app.css?url';

/** Linked (not a side-effect import) so the CSS is in the server HTML on every response, error pages included: no unstyled flash. */
export const links: Route.LinksFunction = () => [{ rel: 'stylesheet', href: stylesheet }];

/** Default tab title and description, used by every route that does not export its own `meta` (see `features/auth/layout.tsx`). */
export const meta: Route.MetaFunction = ({ loaderData }) => {
	const t = getI18n(loaderData?.locale).t;
	return [{ title: t('meta.title') }, { name: 'description', content: t('meta.description') }];
};

/**
 * Decides language and theme on the server so the first paint is already right. The signed-in account's saved settings come first (they are the
 * source of truth), then the stored cookies, then the system theme / `Accept-Language`.
 */
export async function loader({ context, request }: Route.LoaderArgs) {
	const account = await accountPreferences(request, context);
	const languagePreference = account.language ?? readLanguagePreference(request.headers.get('cookie'));
	return {
		languagePreference,
		locale: localeFromPreference(languagePreference, request),
		theme: account.theme ?? themeFromRequest(request),
	};
}

export function Layout({ children }: { children: React.ReactNode }) {
	const data = useRouteLoaderData<typeof loader>('root');
	const i18n = getI18n(data?.locale ?? defaultLocale);
	return (
		<html data-theme={data?.theme === 'light' || data?.theme === 'dark' ? data.theme : undefined} lang={data?.locale ?? defaultLocale} suppressHydrationWarning>
			<head>
				<meta charSet='utf-8' />
				<meta name='viewport' content='width=device-width, initial-scale=1' />
				<Meta />
				<Links />
			</head>
			<body>
				<L.Container className='flex h-screen w-full flex-col overflow-hidden p-0 sm:p-0 lg:p-0' size='full'>
					<I18nextProvider i18n={i18n}>
						<QueryProvider>
							<NuqsAdapter>
								<HotkeysClientProvider>{children}</HotkeysClientProvider>
							</NuqsAdapter>
						</QueryProvider>
					</I18nextProvider>
					<ToasterProvider />
				</L.Container>
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}

export default function App() {
	return <Outlet />;
}

/** Every error lands here (404s from the catch-all route included) and renders the shared error page. */
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	if (isRouteErrorResponse(error) && error.status === 404) return <ErrorPage kind='notFound' />;
	const stack = import.meta.env.DEV && error instanceof Error ? error.stack : undefined;
	return <ErrorPage kind='error' stack={stack} />;
}
