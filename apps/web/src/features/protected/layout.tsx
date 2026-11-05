import { useQueryClient } from '@tanstack/react-query';
import { Menu } from 'lucide-react';
import { type CSSProperties, useLayoutEffect, useRef, useState } from 'react';
import { data, type LoaderFunctionArgs, Navigate, Outlet, redirect, type ShouldRevalidateFunctionArgs, useLoaderData, useLocation } from 'react-router';
import { Icon } from '~/components/ui/foundations/icon/icon';
import { Page } from '~/components/ui/layout/page/page';
import { sessionKey, useSession } from '~/features/auth/api';
import { useTranslate } from '~/hooks/use-translate';
import { requireSignedIn } from '~/lib/session.server';
import bgDark from '../../assets/bg-usegonche-dark.png';
import bgLight from '../../assets/bg-usegonche-light.png';
import { settingsKey } from './settings/api';
import { useSyncPreferences } from './settings/use-preferences';
import { AppSidebar } from './shared/app-sidebar';
import { CommandPalette } from './shared/command-palette';

/**
 * Resolves the session and the settings on the server before anything paints: signed out goes to sign-in and an unfinished onboarding to
 * `/onboarding`, both as redirects, so the signed-in layout never flashes before them. What it resolves seeds the client cache (no second request).
 * Child loaders must still authenticate on their own: a parent loader does not protect them.
 */
export async function loader({ context, request }: LoaderFunctionArgs) {
	const { headers, session, settings } = await requireSignedIn(request, context);
	// Mandatory onboarding: until it is completed, every signed-in page sends the user back to it.
	if (!settings.onboardingCompletedAt) throw redirect('/onboarding', { headers });
	return data({ session, settings }, { headers });
}

/**
 * Moving between signed-in pages (or changing their search params) keeps the session already resolved: the sidebar does not reload and no
 * request is made for it. An explicit `revalidate()` (after signing in or out) still reruns it.
 */
export function shouldRevalidate({ currentUrl, defaultShouldRevalidate, nextUrl }: ShouldRevalidateFunctionArgs) {
	if (currentUrl.href !== nextUrl.href) return false;
	return defaultShouldRevalidate;
}

/** Wraps every signed-in page: the sidebar on the left (an off-canvas drawer below `md`) and the page on the right. Follows the user's light/dark theme. */
export default function ProtectedLayout() {
	const loaderData = useLoaderData<typeof loader>();
	const t = useTranslate();
	const queryClient = useQueryClient();
	// Seeds the shared caches with what the loader resolved, synchronously, so the first render (server and client) already has them.
	if (queryClient.getQueryData(sessionKey) === undefined) queryClient.setQueryData(sessionKey, loaderData.session);
	if (queryClient.getQueryData(settingsKey) === undefined) queryClient.setQueryData(settingsKey, loaderData.settings);
	const { isError } = useSession();
	const [mobileOpen, setMobileOpen] = useState(false);
	const [commandOpen, setCommandOpen] = useState(false);
	// The page scrolls inside `<main>`, not the window, so the router's scroll restoration does not reach it: every new page starts at the top.
	// Only the path counts: changing filters or the page of a list (search params) keeps the scroll.
	const { pathname } = useLocation();
	const main = useRef<HTMLElement>(null);
	// biome-ignore lint/correctness/useExhaustiveDependencies: `pathname` is the trigger, not a value read inside.
	useLayoutEffect(() => {
		main.current?.scrollTo({ top: 0 });
	}, [pathname]);
	useSyncPreferences();

	// The session ended while the page was open (signed out in another tab, expired): back to sign-in.
	if (isError) return <Navigate replace to='/auth/sign-in' />;

	return (
		<div className='relative isolate flex h-screen w-full bg-background text-foreground'>
			<div
				aria-hidden
				className='app-bg pointer-events-none absolute inset-0 -z-10 bg-cover bg-center'
				style={{ '--bg-dark': `url(${bgDark})`, '--bg-light': `url(${bgLight})` } as CSSProperties}
			/>
			<AppSidebar mobileOpen={mobileOpen} onMobileOpenChange={setMobileOpen} onOpenCommand={() => setCommandOpen(true)} />
			<div className='flex min-w-0 flex-1 flex-col'>
				<div className='flex h-12 shrink-0 items-center border-b border-border px-3 md:hidden'>
					<button
						aria-label={t('protected.menu.open')}
						className='flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 ease-in-out hover:bg-muted hover:text-foreground focus-visible:outline-2! focus-visible:outline-offset-2! focus-visible:outline-ring!'
						onClick={() => setMobileOpen(true)}
						type='button'
					>
						<Icon aria-hidden icon={Menu} size='md' />
					</button>
				</div>
				<main className='flex min-h-0 flex-1 flex-col overflow-y-auto' ref={main}>
					<Page.Root className='flex-1 py-4 sm:py-4 lg:py-4' size='full'>
						<Outlet />
					</Page.Root>
				</main>
			</div>
			<CommandPalette onOpenChange={setCommandOpen} open={commandOpen} />
		</div>
	);
}
