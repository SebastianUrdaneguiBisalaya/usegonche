import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@usegonche/api-client';
import { Menu } from 'lucide-react';
import { type CSSProperties, useState } from 'react';
import { type LoaderFunctionArgs, Navigate, Outlet, redirect, useLoaderData } from 'react-router';
import { Icon } from '~/components/ui/foundations/icon/icon';
import { Page } from '~/components/ui/layout/page/page';
import { type Session, sessionKey, useSession } from '~/features/auth/api';
import { useTranslate } from '~/hooks/use-translate';
import { API_BASE } from '~/lib/api';
import bgDark from '../../assets/bg-usegonche-dark.png';
import bgLight from '../../assets/bg-usegonche-light.png';
import { useUserSettings } from './settings/api';
import { useSyncPreferences } from './settings/use-preferences';
import { AppSidebar } from './shared/app-sidebar';
import { CommandPalette } from './shared/command-palette';
import { LayoutSkeleton } from './shared/layout-skeleton';

/**
 * Resolves the session on the server before anything renders: the request cookie is forwarded to `GET /v1/me`. A 401 redirects to sign-in
 * and a valid session is returned so the layout starts with the user already known (no blank screen, no extra request).
 * It only works when the browser sends the session cookie to the web server too (same host in dev, a shared cookie domain in production);
 * otherwise it answers `null` and the client-side check below takes over, behind a skeleton.
 * Child loaders must still authenticate on their own: a parent loader does not protect them.
 */
export async function loader({ request }: LoaderFunctionArgs): Promise<Session | null> {
	const cookie = request.headers.get('cookie');
	if (!cookie) return null;
	const res = await createClient(API_BASE, { headers: { cookie } })
		.me.$get()
		.catch(() => undefined);
	// The API's 401 comes from its global middleware, so it is not part of the inferred response type.
	const status: number | undefined = res?.status;
	if (status === 401) throw redirect('/auth/sign-in');
	if (!res?.ok) return null;
	return (await res.json()).data;
}

/** Wraps every signed-in page: the sidebar on the left (an off-canvas drawer below `md`) and the page on the right. Follows the user's light/dark theme. */
export default function ProtectedLayout() {
	const loaderData = useLoaderData<typeof loader>();
	const t = useTranslate();
	const queryClient = useQueryClient();
	// Seeds the shared session cache with what the loader resolved, synchronously, so the first render (server and client) already has it.
	if (loaderData && queryClient.getQueryData(sessionKey) === undefined) queryClient.setQueryData(sessionKey, loaderData);
	const { data: session, isPending } = useSession();
	const [mobileOpen, setMobileOpen] = useState(false);
	const [commandOpen, setCommandOpen] = useState(false);
	useSyncPreferences();
	const settings = useUserSettings();

	if (isPending || (session && settings.isPending)) return <LayoutSkeleton />;
	if (!session) return <Navigate replace to='/auth/sign-in' />;
	// Mandatory onboarding: until it is completed, every signed-in page sends the user back to it.
	if (settings.data && !settings.data.onboardingCompletedAt) return <Navigate replace to='/onboarding' />;

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
				<main className='flex min-h-0 flex-1 flex-col overflow-y-auto'>
					<Page.Root className='min-h-0 flex-1 py-4 sm:py-4 lg:py-4' size='full'>
						<Outlet />
					</Page.Root>
				</main>
			</div>
			<CommandPalette onOpenChange={setCommandOpen} open={commandOpen} />
		</div>
	);
}
