import { Navigate, Outlet } from 'react-router';
import authBg from '~/assets/bg-auth.webp';
import icon from '~/assets/usegonche-icon.png';
import { Typography } from '~/components/ui/foundations/typography/typography';
import { Layout } from '~/components/ui/layout/layout/layout';
import { Image } from '~/components/ui/media-files/image/image';
import { useSession } from './api';

/** Wraps every `/auth/*` page: dark-only split screen with the artwork on the left and a glass card on the right. */
export default function AuthLayout() {
	const { data: session } = useSession();

	if (session) return <Navigate replace to='/' />;

	return (
		<div className='auth-dark relative isolate h-screen w-full overflow-y-auto bg-[#050505]'>
			<div aria-hidden className='pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_70%_50%,rgba(255,255,255,0.06),transparent_60%)]' />
			<Layout.Grid className='h-full w-full' cols={{ base: 1, lg: 2 }} gap='none'>
				<div className='relative hidden h-full lg:block'>
					<Image className='h-full w-full mask-[linear-gradient(to_top_right,transparent_5%,black_75%)]'>
						<Image.Img alt='Background' className='object-cover object-left' src={authBg} />
						<Image.Fallback>
							<div className='h-full w-full bg-black' />
						</Image.Fallback>
					</Image>
				</div>
				<Layout.Stack className='h-full items-center justify-center px-6 py-10' gap='none'>
					<Layout.Stack
						className='w-full max-w-126 rounded-[28px] border border-white/10 bg-linear-to-b from-white/[0.07] to-white/2 p-5 md:p-10 shadow-[0_24px_80px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl'
						gap='lg'
					>
						<Layout.HStack className='items-center justify-center gap-2'>
							<Image className='-my-8 size-16 overflow-visible'>
								<Image.Img alt='Logo' className='mix-blend-screen' src={icon} />
							</Image>
							<Typography.Span className='-ml-5 text-xl font-medium tracking-tight'>gonche</Typography.Span>
						</Layout.HStack>
						<Outlet />
					</Layout.Stack>
				</Layout.Stack>
			</Layout.Grid>
		</div>
	);
}
