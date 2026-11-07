import { useIsMutating } from '@tanstack/react-query';
import { createClient } from '@usegonche/api-client';
import { type LoaderFunctionArgs, Navigate, Outlet, redirect, useNavigation } from 'react-router';
import bgCompress from '~/assets/bg-usegonche-dark.png';
import icon from '~/assets/usegonche-icon.png';
import { Logo } from '~/components/ui/foundations/logo/logo';
import { Layout } from '~/components/ui/layout/layout/layout';
import { Image } from '~/components/ui/media-files/image/image';
import { Loading } from '~/features/loading/loading';
import { API_BASE } from '~/lib/api';
import { authStepKey, useSession } from './api';

/**
 * Signed-in visitors never see the auth pages: the session cookie of the request is forwarded to `GET /v1/me` and a valid one redirects to `/`
 * before anything renders. It only works when the browser sends that cookie to the web server too (same host in dev, a shared cookie domain
 * in production, see MANUAL.md); otherwise this stays silent and the client-side check in the component takes over.
 */
export async function loader({ request }: LoaderFunctionArgs) {
	const cookie = request.headers.get('cookie');
	if (!cookie) return null;
	const res = await createClient(API_BASE, { headers: { cookie } })
		.me.$get()
		.catch(() => undefined);
	if (res?.ok) throw redirect('/');
	return null;
}

/**
 * Wraps every `/auth/*` page: dark-only split screen with the artwork on the left and a glass card on the right.
 * While a step that opens a session runs (sign in, sign up, Google, password reset), and until the page it leads to has loaded, the whole
 * screen is the loading screen. Once signed in it stays on that screen while `/` loads: a bare `<Navigate>` renders nothing, and that blank
 * frame was the black flash before the home appeared.
 */
export default function AuthLayout() {
	const { data: session } = useSession();
	const busy = useIsMutating({ mutationKey: authStepKey }) > 0;
	// Leaving the auth pages (to `/` or `/onboarding`) waits for their loaders; moving between auth pages does not show it.
	const leaving = useNavigation().location?.pathname.startsWith('/auth') === false;

	if (session)
		return (
			<>
				<Navigate replace to='/' />
				<Loading />
			</>
		);

	return (
		<>
			{/* Outside the glass card: its `backdrop-blur` would trap a fixed element inside the card. The form stays mounted underneath, so its
			    own callbacks (errors, the next navigation) still run; a failure removes the screen and the form is back. */}
			{(busy || leaving) && <Loading />}
			<div className='auth-dark relative isolate h-screen w-full overflow-y-auto bg-[#050505]'>
				<div aria-hidden className='pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(ellipse_at_70%_50%,rgba(255,255,255,0.06),transparent_60%)]' />
				<div aria-hidden className='pointer-events-none absolute inset-0 -z-10 bg-cover bg-center' style={{ backgroundImage: `url(${bgCompress})` }} />
				<Layout.Stack className='h-full items-center justify-center px-6 py-10' gap='none'>
					<Layout.Stack
						className='w-full max-w-126 rounded-[28px] border border-white/10 bg-linear-to-b from-white/[0.07] to-white/2 p-5 md:p-10 shadow-[0_24px_80px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl'
						gap='lg'
					>
						<Layout.HStack className='w-full items-center justify-center gap-2'>
							<Image className='-my-8 size-16 overflow-visible'>
								<Image.Img alt='' className='mix-blend-screen' src={icon} />
							</Image>
							<Logo className='-ml-5' size='lg'>
								<Logo.Text className='font-medium'>gonche</Logo.Text>
							</Logo>
						</Layout.HStack>
						<Outlet />
					</Layout.Stack>
				</Layout.Stack>
			</div>
		</>
	);
}
