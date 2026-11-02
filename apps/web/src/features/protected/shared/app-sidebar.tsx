import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import icon from '~/assets/usegonche-icon.png';
import { Avatar } from '~/components/ui/data-display/avatar/avatar';
import { Icon } from '~/components/ui/foundations/icon/icon';
import { Logo } from '~/components/ui/foundations/logo/logo';
import { Separator } from '~/components/ui/foundations/separator/separator';
import { Image } from '~/components/ui/media-files/image/image';
import { Sidebar } from '~/components/ui/navigation/sidebar/sidebar';
import { UserProfile } from '~/components/ui/navigation/user-profile/user-profile';
import { SettingsDialog } from '~/components/ui/overlays-feedback/settings-dialog/settings-dialog';
import { cn } from '~/components/ui/utils/tailwind/cn';
import { useSession } from '~/features/auth/api';
import { useTranslate } from '~/hooks/use-translate';
import { isActive, primaryNav, secondaryNav } from './navigation';
import { shortcutKeys } from './shortcut-keys';

interface AppSidebarProps {
	mobileOpen: boolean;
	onMobileOpenChange: (open: boolean) => void;
	onOpenCommand: () => void;
}

const avatarInitialsClassName = 'flex items-center justify-center bg-muted text-xs font-semibold text-muted-foreground';

/** Two initials of the name: first letters of the first two words, or the first two letters of a single word (an email prefix too). */
export function initialsOf(name: string): string {
	const words = name.split(/[\s._-]+/).filter(Boolean);
	const letters = words.length > 1 ? `${words[0]?.[0] ?? ''}${words[1]?.[0] ?? ''}` : (words[0] ?? '').slice(0, 2);
	return letters.toUpperCase();
}

function DailyProgress({ done, total }: { done: number; total: number }) {
	const t = useTranslate();
	const percent = total === 0 ? 0 : Math.round((done / total) * 100);
	const radius = 26;
	const circumference = 2 * Math.PI * radius;

	return (
		<div className='flex flex-col items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 py-4'>
			<div className='relative size-16'>
				<svg aria-hidden className='size-full -rotate-90' viewBox='0 0 64 64'>
					<circle className='stroke-border' cx='32' cy='32' fill='none' r={radius} strokeWidth='5' />
					<circle
						className='stroke-foreground transition-[stroke-dashoffset] duration-500 ease-out'
						cx='32'
						cy='32'
						fill='none'
						r={radius}
						strokeDasharray={circumference}
						strokeDashoffset={circumference * (1 - percent / 100)}
						strokeLinecap='round'
						strokeWidth='5'
					/>
				</svg>
				<span className='absolute inset-0 flex items-center justify-center font-primary text-sm font-medium text-foreground'>{percent}%</span>
			</div>
			<div className='flex flex-col items-center gap-0.5 text-center font-primary text-xs text-muted-foreground'>
				<span>{t('protected.progress.title')}</span>
				<span>{t('protected.progress.summary', { done, total })}</span>
			</div>
		</div>
	);
}

/** Layout chrome of every protected page: brand, search/command trigger, Flow Cycle navigation, daily progress and the account. */
export function AppSidebar({ mobileOpen, onMobileOpenChange, onOpenCommand }: AppSidebarProps) {
	const t = useTranslate();
	const navigate = useNavigate();
	const { pathname } = useLocation();
	const { data: session } = useSession();
	const [collapsed, setCollapsed] = useState(false);
	const [settingsOpen, setSettingsOpen] = useState(false);

	const name = session?.profile?.displayName ?? '';
	const avatarUrl = session?.profile?.avatarUrl || undefined;
	const initials = initialsOf(name);

	const renderItem = (entry: (typeof primaryNav)[number]) => (
		<Sidebar.NavItem
			active={isActive(pathname, entry.to)}
			href={entry.to}
			icon={entry.icon}
			key={entry.id}
			onClick={event => {
				if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
				event.preventDefault();
				void navigate(entry.to);
			}}
		>
			{t(entry.label)}
		</Sidebar.NavItem>
	);

	return (
		<>
			<Sidebar collapsed={collapsed} mobileOpen={mobileOpen} onCollapsedChange={setCollapsed} onMobileOpenChange={onMobileOpenChange}>
				<Sidebar.Header>
					<Sidebar.Brand
						href='/'
						onClick={event => {
							event.preventDefault();
							void navigate('/');
						}}
					>
						<Logo size='lg'>
							<Image className='-my-6 size-14 overflow-visible'>
								<Image.Img alt='' className='mix-blend-difference' src={icon} />
							</Image>
							<Logo.Text className='-ml-4 font-medium'>gonche</Logo.Text>
						</Logo>
					</Sidebar.Brand>
					<Sidebar.CollapseTrigger />
					<Sidebar.MobileCloseTrigger />
				</Sidebar.Header>

				<Sidebar.SearchTrigger
					className='rounded-xl bg-muted/50'
					onClick={() => {
						onMobileOpenChange(false);
						onOpenCommand();
					}}
					shortcut={shortcutKeys('mod+k')}
				/>

				<Sidebar.Nav>
					{primaryNav.map(renderItem)}
					<li aria-hidden className='px-2.5 py-3'>
						<Separator decorative />
					</li>
					{secondaryNav.map(renderItem)}
				</Sidebar.Nav>

				{!collapsed && <DailyProgress done={0} total={0} />}

				<Sidebar.Footer className='gap-1'>
					<UserProfile onOpenChange={open => open && setSettingsOpen(true)} open={false}>
						<UserProfile.Trigger
							avatar={
								<Avatar size='sm'>
									{avatarUrl ? (
										<>
											<Avatar.Img alt={name} src={avatarUrl} />
											<Avatar.Skeleton />
											<Avatar.Fallback className={avatarInitialsClassName}>{initials}</Avatar.Fallback>
										</>
									) : (
										// `Avatar.Fallback` only appears after an image error, and without an image there is nothing to fail: draw the initials directly.
										<span className={cn('absolute inset-0', avatarInitialsClassName)}>{initials}</span>
									)}
								</Avatar>
							}
							collapsed={collapsed}
							name={
								<span className='flex items-center justify-between gap-2'>
									<span className='truncate'>{name}</span>
									<Icon aria-hidden className='shrink-0 text-muted-foreground' icon={ChevronRight} size='sm' />
								</span>
							}
						/>
					</UserProfile>
				</Sidebar.Footer>
			</Sidebar>

			<SettingsDialog.Root onOpenChange={setSettingsOpen} open={settingsOpen}>
				<SettingsDialog.Content title={t('protected.settings.title')}>
					<SettingsDialog.Main />
				</SettingsDialog.Content>
			</SettingsDialog.Root>
		</>
	);
}
