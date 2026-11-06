'use client';

import { Calendar, ChevronRight, CircleCheck, CircleDot, FileText, FolderKanban, Inbox, type LucideIcon, Orbit, Search, Target } from 'lucide-react';
import type { ReactNode } from 'react';
import { Avatar } from '@/components/ui/data-display/avatar/avatar';
import { Checkbox } from '@/components/ui/forms-inputs/checkbox/checkbox';
import { Icon } from '@/components/ui/foundations/icon/icon';
import { Logo } from '@/components/ui/foundations/logo/logo';
import { Typography } from '@/components/ui/foundations/typography/typography';
import { Image } from '@/components/ui/media-files/image/image';
import { WindowFrame } from '@/components/ui/media-files/window-frame/window-frame';
import { cn } from '@/components/ui/utils/tailwind/cn';
import { glass } from '@/styles/glass';
import { checkboxClass } from './mockup';

/** Fixed "today" of the mockups, so the server and the browser render the same calendar. */
const MOCK_TODAY = new Date(2026, 10, 6);

const tasks = [
	{ done: true, label: 'Finish landing page design' },
	{ done: false, label: 'Workout at the gym' },
	{ done: false, label: 'Read 20 pages' },
] as const;

/** Same entries, icons and order as the web app sidebar (`apps/web` primary navigation). */
const navItems: readonly { icon: LucideIcon; label: string }[] = [
	{ icon: Inbox, label: 'Inbox' },
	{ icon: CircleDot, label: 'Today' },
	{ icon: Calendar, label: 'Calendar' },
	{ icon: FolderKanban, label: 'Projects' },
	{ icon: Target, label: 'Goals' },
	{ icon: CircleCheck, label: 'Tasks' },
	{ icon: FileText, label: 'Notes' },
	{ icon: Orbit, label: 'Reflect' },
];

const weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

/** Days of the month grid (Sunday first), with the neighbour months' days marked as outside. */
function monthGrid(today: Date) {
	const year = today.getFullYear();
	const month = today.getMonth();
	const start = new Date(year, month, 1 - new Date(year, month, 1).getDay());
	const weeks = Math.ceil((new Date(year, month, 1).getDay() + new Date(year, month + 1, 0).getDate()) / 7);
	return Array.from({ length: weeks * 7 }, (_, i) => {
		const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
		return { date: day.getDate(), key: day.toISOString(), outside: day.getMonth() !== month, today: day.getTime() === today.getTime() };
	});
}

/** The plan's tasks: "Finish landing page design" done, the rest open. */
export function TaskList({ className }: { className?: string }) {
	return (
		<Typography.List className={cn('my-0 ml-0 flex list-none flex-col gap-3 [&>li]:mt-0', className)}>
			{tasks.map(task => (
				<li key={task.label}>
					<Checkbox defaultChecked={task.done}>
						<Checkbox.Toggle className={checkboxClass} />
						<Checkbox.Label className='font-normal text-[11px] text-foreground/80'>{task.label}</Checkbox.Label>
					</Checkbox>
				</li>
			))}
		</Typography.List>
	);
}

/** Month calendar card with today highlighted. */
export function MiniMonth({ className }: { className?: string }) {
	const label = MOCK_TODAY.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
	return (
		<div className={cn(glass.card, 'flex w-44 shrink-0 flex-col gap-2 p-3', className)}>
			<div className='flex items-center justify-between'>
				<Typography.Small className='text-xs'>{label}</Typography.Small>
				<Icon aria-hidden='true' className='text-foreground/40' icon={ChevronRight} size='xs' />
			</div>
			<div className='grid grid-cols-7 gap-y-1 text-center'>
				{weekdays.map((day, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: the weekday letters repeat (T, S).
					<Typography.Span className='text-[9px] text-foreground/45' key={i}>
						{day}
					</Typography.Span>
				))}
				{monthGrid(MOCK_TODAY).map(day => (
					<Typography.Span
						className={cn(
							'mx-auto flex size-4.5 items-center justify-center rounded-full text-[9px]',
							day.outside ? 'text-foreground/20' : 'text-foreground/70',
							day.today && 'bg-foreground font-semibold text-background'
						)}
						key={day.key}
					>
						{day.date}
					</Typography.Span>
				))}
			</div>
		</div>
	);
}

interface AppWindowProps {
	/** The main area, next to the sidebar. */
	children: ReactNode;
	/** Size, position and surface of the window. */
	className?: string;
}

/** The app as a window: title bar with the avatar, the web app's sidebar (logo, search, navigation with Today selected) and a main area. */
export function AppWindow({ children, className }: AppWindowProps) {
	return (
		<WindowFrame.Root aria-label='Gonche Today screen' className={cn('rounded-2xl', className)} shadow={false}>
			<WindowFrame.TitleBar className='flex h-10 border-none bg-transparent px-4'>
				<WindowFrame.Controls />
				<WindowFrame.Actions className='ml-auto'>
					<Avatar className='size-7' size='sm'>
						{/* `Avatar.Fallback` only shows after an image error; without an image, draw the initials directly (as the web app does). */}
						<Typography.Span className='absolute inset-0 flex items-center justify-center bg-white/15 font-medium text-[10px]'>JD</Typography.Span>
					</Avatar>
				</WindowFrame.Actions>
			</WindowFrame.TitleBar>
			<WindowFrame.Content className='flex bg-transparent'>
				<div className='flex w-[140px] shrink-0 flex-col gap-2.5 px-3 pb-3'>
					<Logo size='sm'>
						<Image className='-my-3 size-9 overflow-visible'>
							<Image.Img alt='' className='mix-blend-screen' src='/usegonche-icon.png' />
						</Image>
						<Logo.Text className='-ml-3 font-medium'>gonche</Logo.Text>
					</Logo>
					<div className='flex h-6 items-center gap-1.5 rounded-lg bg-white/[0.05] px-2 text-foreground/40'>
						<Icon aria-hidden='true' icon={Search} size='xs' />
						<Typography.Span className='flex-1 text-[10px] text-inherit'>Search</Typography.Span>
						<Typography.Span className='text-[9px] text-inherit'>⌘K</Typography.Span>
					</div>
					<div className='flex flex-col gap-px'>
						{navItems.map(item => (
							<div className={cn('flex items-center gap-2 rounded-lg px-2 py-1', item.label === 'Today' ? 'bg-white/10 text-foreground' : 'text-foreground/45')} key={item.label}>
								<Icon aria-hidden='true' icon={item.icon} size='xs' />
								<Typography.Span className='text-[10px] text-inherit'>{item.label}</Typography.Span>
							</div>
						))}
					</div>
				</div>
				<div className='flex min-w-0 flex-1 flex-col gap-4 pr-4 pb-4'>
					<div className='flex flex-col gap-1'>
						<Typography.Small className='text-base'>Today</Typography.Small>
						<Typography.Span className='text-[10px] text-foreground/50'>Focus on what moves you forward.</Typography.Span>
					</div>
					{children}
				</div>
			</WindowFrame.Content>
		</WindowFrame.Root>
	);
}
