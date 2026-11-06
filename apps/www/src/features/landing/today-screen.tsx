'use client';

import {
	ArrowRight,
	Bell,
	Calendar,
	CalendarClock,
	CalendarDays,
	ChartNoAxesColumnIncreasing,
	ChevronRight,
	CircleCheck,
	CircleDot,
	FileText,
	Flag,
	FolderKanban,
	Inbox,
	type LucideIcon,
	OctagonAlert,
	Orbit,
	PanelLeft,
	Plus,
	Search,
	Tag,
	Target,
	Zap,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Avatar } from '@/components/ui/data-display/avatar/avatar';
import { MiniCalendar } from '@/components/ui/data-display/mini-calendar/mini-calendar';
import { Pill } from '@/components/ui/data-display/pill/pill';
import { Progress } from '@/components/ui/data-display/progress/progress';
import { Checkbox } from '@/components/ui/forms-inputs/checkbox/checkbox';
import { Icon } from '@/components/ui/foundations/icon/icon';
import { Logo } from '@/components/ui/foundations/logo/logo';
import { Separator } from '@/components/ui/foundations/separator/separator';
import { Typography } from '@/components/ui/foundations/typography/typography';
import { Image } from '@/components/ui/media-files/image/image';
import { WindowFrame } from '@/components/ui/media-files/window-frame/window-frame';
import { cn } from '@/components/ui/utils/tailwind/cn';
import { checkboxClass, type Priority, PriorityPill, ProgressBar } from './mockup';

/** Glass card of the web app's list pages (`listStyles.card`). */
const card = 'rounded-2xl border border-white/10 bg-white/[0.03]';

/** Pill-shaped control of the web app (`listStyles.pillTrigger` / `pillInput`). */
const control = 'flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5';

/* --------------------------------------------------------------- Sidebar */

/** Same entries, icons and order as `apps/web` (`shared/navigation.ts`). */
const primaryNav: readonly { icon: LucideIcon; label: string }[] = [
	{ icon: Inbox, label: 'Inbox' },
	{ icon: CircleDot, label: 'Today' },
	{ icon: Calendar, label: 'Calendar' },
	{ icon: FolderKanban, label: 'Projects' },
	{ icon: Target, label: 'Goals' },
	{ icon: CircleCheck, label: 'Tasks' },
	{ icon: FileText, label: 'Notes' },
	{ icon: Orbit, label: 'Reflect' },
];

const secondaryNav: readonly { icon: LucideIcon; label: string }[] = [
	{ icon: Tag, label: 'Tags' },
	{ icon: ChartNoAxesColumnIncreasing, label: 'Analytics' },
	{ icon: Bell, label: 'Reminders' },
];

function NavItem({ icon, label }: { icon: LucideIcon; label: string }) {
	return (
		<div className={cn('flex h-8 items-center gap-2.5 rounded-lg px-2.5', label === 'Today' ? 'bg-white/10 text-foreground' : 'text-foreground/55')}>
			<Icon aria-hidden='true' icon={icon} size='sm' />
			<Typography.Span className='text-[13px] text-inherit'>{label}</Typography.Span>
		</div>
	);
}

/** The sidebar's daily progress ring (tasks of today's plan done). */
function DailyProgress({ done, total }: { done: number; total: number }) {
	const percent = Math.round((done / total) * 100);
	return (
		<div className='flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-4'>
			<Progress size={64} strokeWidth={5} value={percent} variant='circle'>
				<Progress.Indicator />
				<Typography.Span className='absolute inset-0 flex items-center justify-center font-medium text-sm'>{percent}%</Typography.Span>
			</Progress>
			<div className='flex flex-col items-center gap-0.5 text-foreground/55'>
				<Typography.Span className='text-xs text-inherit'>Daily progress</Typography.Span>
				<Typography.Span className='text-xs text-inherit'>
					{done} of {total} tasks
				</Typography.Span>
			</div>
		</div>
	);
}

function Sidebar() {
	return (
		<aside className='flex w-[220px] shrink-0 flex-col gap-3 border-white/[0.06] border-r px-3 pt-1 pb-3'>
			<div className='flex items-center justify-between pl-1'>
				<Logo size='lg'>
					<Image className='-my-6 size-14 overflow-visible'>
						<Image.Img alt='' className='mix-blend-screen' src='/usegonche-icon.png' />
					</Image>
					<Logo.Text className='-ml-4 font-medium'>gonche</Logo.Text>
				</Logo>
				<Icon aria-hidden='true' className='text-foreground/45' icon={PanelLeft} size='sm' />
			</div>
			<div className='flex h-9 items-center gap-2 rounded-xl bg-white/[0.05] px-3 text-foreground/45'>
				<Icon aria-hidden='true' icon={Search} size='sm' />
				<Typography.Span className='flex-1 text-[13px] text-inherit'>Search</Typography.Span>
				<Typography.Span className='text-[11px] text-inherit'>⌘K</Typography.Span>
			</div>
			<div className='flex flex-col gap-0.5'>
				{primaryNav.map(item => (
					<NavItem icon={item.icon} key={item.label} label={item.label} />
				))}
				<div className='px-2.5 py-3'>
					<Separator decorative />
				</div>
				{secondaryNav.map(item => (
					<NavItem icon={item.icon} key={item.label} label={item.label} />
				))}
			</div>
			<div className='mt-auto flex flex-col gap-2'>
				<DailyProgress done={1} total={4} />
				<div className='flex items-center gap-2.5 rounded-lg px-2 py-1.5'>
					<Avatar className='size-8' size='sm'>
						<Typography.Span className='absolute inset-0 flex items-center justify-center bg-white/15 font-semibold text-[11px] text-foreground/70'>JD</Typography.Span>
					</Avatar>
					<Typography.Span className='flex-1 truncate text-[13px]'>John Doe</Typography.Span>
					<Icon aria-hidden='true' className='text-foreground/45' icon={ChevronRight} size='sm' />
				</div>
			</div>
		</aside>
	);
}

/* ---------------------------------------------------------------- Cards */

function CardTitle({ children, icon, iconClassName }: { children: ReactNode; icon?: LucideIcon; iconClassName?: string }) {
	return (
		<span className='flex items-center gap-2'>
			{icon && <Icon aria-hidden='true' className={cn('text-foreground/55', iconClassName)} icon={icon} size='md' />}
			<Typography.Span className='font-semibold text-[15px]'>{children}</Typography.Span>
		</span>
	);
}

function ViewAll({ label = 'View all' }: { label?: string }) {
	return (
		<span className='flex items-center gap-1 text-foreground/50'>
			<Typography.Span className='text-[11px] text-inherit'>{label}</Typography.Span>
			<Icon aria-hidden='true' icon={ArrowRight} size='xs' />
		</span>
	);
}

/** Fixed dates of the mockup, so the server and the browser render the same strip: Nov 3–9 with Fri 6 selected, like the web app (today ± 3 days). */
const SELECTED_DAY = new Date(2026, 10, 6);
const STRIP_START = new Date(2026, 10, 3);

function DayStrip() {
	return (
		<MiniCalendar className='shrink-0' days={7} defaultStartDate={STRIP_START} locale='en-US' value={SELECTED_DAY}>
			<MiniCalendar.Navigation direction='prev' />
			<MiniCalendar.Days>{date => <MiniCalendar.Day date={date} key={date.toISOString()} />}</MiniCalendar.Days>
			<MiniCalendar.Navigation direction='next' />
		</MiniCalendar>
	);
}

const HOUR_PX = 52;
const FIRST_HOUR = 8;
const agendaHours = [8, 9, 10, 11, 12, 13, 14, 15, 16] as const;

/** Time blocks of the day, in minutes from midnight. */
const agendaBlocks = [
	{ end: 600, start: 480, title: 'Deep work' },
	{ end: 810, start: 720, title: 'Write weekly report' },
	{ end: 960, start: 900, title: 'Workout at the gym' },
] as const;

const hourLabel = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
const toPx = (minutes: number) => ((minutes - FIRST_HOUR * 60) / 60) * HOUR_PX;

function AgendaCard() {
	return (
		<section className={cn(card, 'flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-5')}>
			<div className='flex items-center justify-between'>
				<CardTitle>Day agenda</CardTitle>
				<span className={cn(control, 'h-8 px-3')}>
					<Icon aria-hidden='true' icon={Plus} size='xs' />
					<Typography.Span className='text-xs'>New block</Typography.Span>
				</span>
			</div>
			<div className='relative ml-14'>
				{agendaHours.map(hour => (
					<div className='relative border-white/[0.07] border-t' key={hour} style={{ height: HOUR_PX }}>
						<Typography.Span className='-left-14 -top-2 absolute w-12 text-right text-foreground/45 text-xs tabular-nums'>{hourLabel(hour * 60)}</Typography.Span>
					</div>
				))}
				{agendaBlocks.map(block => (
					<div
						className='absolute inset-x-1 flex flex-col justify-center rounded-lg border border-white/10 bg-white/[0.08] px-3'
						key={block.title}
						style={{ height: toPx(block.end) - toPx(block.start) - 2, top: toPx(block.start) + 1 }}
					>
						<Typography.Span className='truncate font-medium text-sm'>{block.title}</Typography.Span>
						<Typography.Span className='text-foreground/50 text-xs tabular-nums'>
							{hourLabel(block.start)} – {hourLabel(block.end)}
						</Typography.Span>
					</div>
				))}
				{/* Now line, like the web app's (10:40). */}
				<div aria-hidden className='absolute inset-x-0 border-foreground border-t-2' style={{ top: toPx(640) }}>
					<span className='-left-1 -top-1.5 absolute size-2.5 rounded-full bg-foreground' />
				</div>
			</div>
		</section>
	);
}

function ReplanCard() {
	return (
		<section className={cn(card, 'flex flex-col gap-3 p-5')}>
			<div className='flex flex-col gap-1'>
				<CardTitle icon={CalendarClock}>Replan</CardTitle>
				<Typography.Span className='text-foreground/50 text-xs'>Missed or interrupted blocks. Nothing changes until you accept.</Typography.Span>
			</div>
			<div className='flex flex-col gap-2 rounded-xl border border-white/10 px-3 py-2.5'>
				<div className='flex items-center justify-between gap-2'>
					<Typography.Span className='truncate font-medium text-sm'>Read 20 pages</Typography.Span>
					<Pill className='px-2 py-0.5' variant='outline'>
						<Pill.Text className='text-[11px]'>Missed</Pill.Text>
					</Pill>
				</div>
				<Typography.Span className='text-foreground/50 text-xs'>30m left · proposed: 17:00</Typography.Span>
				<div className='flex justify-end gap-2'>
					<span className='rounded-lg px-3 py-1.5'>
						<Typography.Span className='text-xs'>Dismiss</Typography.Span>
					</span>
					<span className='rounded-lg bg-foreground px-3 py-1.5'>
						<Typography.Span className='font-medium text-background text-xs'>Accept</Typography.Span>
					</span>
				</div>
			</div>
		</section>
	);
}

function CapacityCard() {
	return (
		<section className={cn(card, 'flex flex-col gap-3 p-5')}>
			<div className='flex items-center justify-between gap-3'>
				<CardTitle>Capacity</CardTitle>
				<Typography.Span className='text-foreground/50 text-xs tabular-nums'>4h 30m planned of 6h available</Typography.Span>
			</div>
			<ProgressBar value={75} />
			<Typography.Span className='text-foreground/50 text-xs'>1h 30m left</Typography.Span>
		</section>
	);
}

const planTasks: readonly { done: boolean; estimate: string; priority: Priority; title: string }[] = [
	{ done: true, estimate: '2h', priority: 'high', title: 'Finish landing page design' },
	{ done: false, estimate: '1h 30m', priority: 'urgent', title: 'Write weekly report' },
	{ done: false, estimate: '1h', priority: 'low', title: 'Workout at the gym' },
	{ done: false, estimate: '30m', priority: 'medium', title: 'Read 20 pages' },
];

function PlanCard() {
	return (
		<section className={cn(card, 'flex min-h-0 flex-1 flex-col gap-4 p-5')}>
			<div className='flex items-center justify-between gap-3'>
				<Typography.Span className='font-semibold text-lg'>Plan for today</Typography.Span>
				<Typography.Span className='text-foreground/50 text-sm tabular-nums'>1 of 4 tasks</Typography.Span>
			</div>
			<ProgressBar value={25} />
			<ul className='flex flex-col'>
				{planTasks.map(task => (
					<li className='flex items-center gap-3 px-1 py-2' key={task.title}>
						<Checkbox className='min-w-0 flex-1' defaultChecked={task.done}>
							<Checkbox.Toggle className={checkboxClass} />
							<Checkbox.Label className={cn('truncate font-normal text-sm', task.done && 'text-foreground/45 line-through')}>{task.title}</Checkbox.Label>
						</Checkbox>
						<Typography.Span className='text-foreground/50 text-xs tabular-nums'>{task.estimate}</Typography.Span>
						<PriorityPill className='text-[11px]' priority={task.priority} />
					</li>
				))}
			</ul>
			<div className={cn(control, 'mt-auto text-foreground/40')}>
				<Typography.Span className='text-inherit text-sm'>Add task…</Typography.Span>
			</div>
		</section>
	);
}

function BlockedCard() {
	return (
		<section className={cn(card, 'flex flex-col gap-3 p-5')}>
			<div className='flex items-center justify-between gap-3'>
				<CardTitle icon={OctagonAlert} iconClassName='text-destructive'>
					Blocked
				</CardTitle>
				<ViewAll label='1 task' />
			</div>
			<Typography.Span className='truncate text-sm'>Write weekly report</Typography.Span>
		</section>
	);
}

/** History events of the user's tasks, with the same icons as the web app. */
const activity: readonly { icon: LucideIcon; iconClassName?: string; label: string; task: string; time: string }[] = [
	{ icon: CircleCheck, iconClassName: 'text-success', label: 'Completed', task: 'Finish landing page design', time: '12m' },
	{ icon: Flag, label: 'Priority changed', task: 'Write weekly report', time: '1h' },
	{ icon: CalendarClock, label: 'Due date changed', task: 'Read 20 pages', time: '3h' },
	{ icon: FolderKanban, label: 'Project changed', task: 'Plan a trip to Cusco', time: '5h' },
];

function RecentActivityCard() {
	return (
		<section className={cn(card, 'flex flex-col gap-4 p-5')}>
			<CardTitle icon={Zap}>Recent activity</CardTitle>
			<ul className='flex flex-col gap-3'>
				{activity.map(event => (
					<li className='flex items-center gap-3' key={event.label}>
						<Icon aria-hidden='true' className={cn('shrink-0', event.iconClassName ?? 'text-foreground/50')} icon={event.icon} size='md' />
						<span className='flex min-w-0 flex-1 items-baseline gap-2'>
							<Typography.Span className='shrink-0 font-medium text-sm'>{event.label}</Typography.Span>
							<Typography.Span className='truncate text-foreground/50 text-sm'>{event.task}</Typography.Span>
						</span>
						<Typography.Span className='shrink-0 text-foreground/45 text-xs'>{event.time}</Typography.Span>
					</li>
				))}
			</ul>
		</section>
	);
}

const inboxItems = ['Plan a trip to Cusco in March', 'Read “Deep Work” notes again', 'Call the bank about the card'] as const;

function InboxCard() {
	return (
		<section className={cn(card, 'flex min-h-0 flex-1 flex-col gap-3 p-5')}>
			<div className='flex items-center justify-between gap-3'>
				<span className='flex items-center gap-2'>
					<CardTitle>Inbox</CardTitle>
					<Pill className='px-2 py-0.5' variant='outline'>
						<Pill.Text className='text-[11px]'>4</Pill.Text>
					</Pill>
				</span>
				<ViewAll />
			</div>
			<ul className='flex flex-col gap-2'>
				{inboxItems.map(item => (
					<li key={item}>
						<Typography.Span className='block truncate text-sm'>{item}</Typography.Span>
					</li>
				))}
			</ul>
		</section>
	);
}

/* ---------------------------------------------------------------- Screen */

/**
 * The desktop app's Today page, laid out like `apps/web` (`today/today.tsx`): the full sidebar, the page header with the date and quick
 * capture, and the three-column grid (day strip + agenda | replan, capacity, plan | blocked, recent activity, inbox).
 */
export function TodayScreen() {
	return (
		<WindowFrame.Root aria-label='Gonche Today screen' className='h-full w-full rounded-none border-none bg-neutral-950' shadow={false}>
			<WindowFrame.TitleBar className='flex h-9 border-none bg-transparent px-4'>
				<WindowFrame.Controls />
			</WindowFrame.TitleBar>
			<WindowFrame.Content className='flex bg-transparent'>
				<Sidebar />
				<main className='flex min-w-0 flex-1 flex-col gap-6 px-6 pt-2 pb-6'>
					<header className='flex items-start justify-between gap-6'>
						<div className='flex flex-col gap-1'>
							<Typography.Span className='font-semibold text-2xl tracking-tight'>Today</Typography.Span>
							<Typography.Span className='text-foreground/55 text-sm'>Focus on what moves you forward.</Typography.Span>
						</div>
						<div className='flex items-center gap-2'>
							<span className={control}>
								<Icon aria-hidden='true' className='text-foreground/50' icon={CalendarDays} size='sm' />
								<Typography.Span className='text-sm tabular-nums'>Fri, Nov 6, 2026</Typography.Span>
							</span>
							<span className={cn(control, 'w-80 text-foreground/40')}>
								<Icon aria-hidden='true' icon={Plus} size='sm' />
								<Typography.Span className='truncate text-inherit text-sm'>Quick capture... (tasks, ideas, notes, reminders)</Typography.Span>
							</span>
						</div>
					</header>
					<div className='grid min-h-0 flex-1 grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] gap-4'>
						<div className='flex min-h-0 flex-col gap-4'>
							<DayStrip />
							<AgendaCard />
						</div>
						<div className='flex min-h-0 flex-col gap-4'>
							<ReplanCard />
							<CapacityCard />
							<PlanCard />
						</div>
						<div className='flex min-h-0 flex-col gap-4'>
							<BlockedCard />
							<RecentActivityCard />
							<InboxCard />
						</div>
					</div>
				</main>
			</WindowFrame.Content>
		</WindowFrame.Root>
	);
}
