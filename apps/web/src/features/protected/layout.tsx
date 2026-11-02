import { Menu } from 'lucide-react';
import { useState } from 'react';
import { Navigate, Outlet } from 'react-router';
import { Icon } from '~/components/ui/foundations/icon/icon';
import { useSession } from '~/features/auth/api';
import { useTranslate } from '~/hooks/use-translate';
import { AppSidebar } from './shared/app-sidebar';
import { CommandPalette } from './shared/command-palette';

/** Wraps every signed-in page: the sidebar on the left (an off-canvas drawer below `md`) and the page on the right. Follows the user's light/dark theme. */
export default function ProtectedLayout() {
	const t = useTranslate();
	const { data: session, isPending } = useSession();
	const [mobileOpen, setMobileOpen] = useState(false);
	const [commandOpen, setCommandOpen] = useState(false);

	if (isPending) return null;
	if (!session) return <Navigate replace to='/auth/sign-in' />;

	return (
		<div className='flex h-screen w-full bg-background text-foreground'>
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
				<main className='min-h-0 flex-1 overflow-y-auto'>
					<Outlet />
				</main>
			</div>
			<CommandPalette onOpenChange={setCommandOpen} open={commandOpen} />
		</div>
	);
}
