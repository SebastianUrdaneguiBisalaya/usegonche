'use client';

import { BookOpen, Calendar, ChevronRight, CircleCheck, CircleDot, Dumbbell, FileText, FolderKanban, Inbox, type LucideIcon, Orbit, Plus, Search, Target } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import { ToggleGroup } from '@/components/ui/actions-controls/toggle-group/toggle-group';
import { Avatar } from '@/components/ui/data-display/avatar/avatar';
import { Checkbox } from '@/components/ui/forms-inputs/checkbox/checkbox';
import { Icon } from '@/components/ui/foundations/icon/icon';
import { Logo } from '@/components/ui/foundations/logo/logo';
import { Typography } from '@/components/ui/foundations/typography/typography';
import { Image } from '@/components/ui/media-files/image/image';
import { WindowFrame } from '@/components/ui/media-files/window-frame/window-frame';
import { cn } from '@/components/ui/utils/tailwind/cn';
import { glass } from '@/styles/glass';

/** Design size of the mockup canvas (px). It is drawn at this size and scaled down to fit its column. */
const CANVAS = { height: 550, width: 800 } as const;

/** Vertical room the floating navbar and the section padding take at `xl`, where the hero is exactly one screen tall. */
const XL_RESERVED_HEIGHT = 200;

/** Fixed "today" of the mockup, so the server and the browser render the same calendar. */
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

const projects = [
	{ color: 'bg-chart-1', count: 4, name: 'Learning' },
	{ color: 'bg-chart-4', count: 3, name: 'Health & Fitness' },
	{ color: 'bg-chart-2', count: 5, name: 'Work' },
	{ color: 'bg-chart-3', count: 2, name: 'Side project' },
	{ color: 'bg-chart-5', count: 6, name: 'Home' },
] as const;

const notes = [
	{ date: 'Today', title: 'Ideas for tomorrow' },
	{ date: 'Yesterday', title: 'Weekly review' },
	{ date: 'Nov 3', title: 'Book highlights' },
] as const;

const hours = ['08:00', '10:00', '12:00', '14:00'] as const;

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

/** Unchecked boxes are soft grey squares, checked ones white, like the app. */
const checkboxClass = 'size-3.5 rounded-[4px] data-[state=unchecked]:border-transparent data-[state=unchecked]:bg-white/15';

function TaskList({ className }: { className?: string }) {
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

function CardHeader({ title, meta }: { title: string; meta?: string }) {
	return (
		<div className='flex items-center justify-between'>
			<Typography.Small className='text-xs'>{title}</Typography.Small>
			{meta && <Typography.Span className='text-[10px] text-foreground/45'>{meta}</Typography.Span>}
		</div>
	);
}

function MiniMonth() {
	const label = MOCK_TODAY.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
	return (
		<div className={cn(glass.card, 'flex w-44 shrink-0 flex-col gap-2 p-3')}>
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

function AppWindow() {
	return (
		<WindowFrame.Root aria-label='Gonche Today screen' className={cn(glass.floating, 'absolute top-0 right-0 h-[340px] w-[570px] rounded-2xl')} shadow={false}>
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
					<div className='flex flex-1 gap-3'>
						<div className={cn(glass.card, 'flex min-w-0 flex-1 flex-col gap-4 p-3')}>
							<CardHeader meta='1 of 3 tasks' title='Plan for today' />
							<TaskList />
						</div>
						<MiniMonth />
					</div>
				</div>
			</WindowFrame.Content>
		</WindowFrame.Root>
	);
}

function ProjectsCard() {
	return (
		<div className={cn(glass.floating, 'absolute top-[170px] left-5 flex w-[240px] flex-col gap-4 rounded-2xl p-4')}>
			<CardHeader title='Projects' />
			<div className='flex flex-col gap-3'>
				{projects.map(project => (
					<div className='flex items-center gap-2.5' key={project.name}>
						<span aria-hidden className={cn('size-2.5 rounded-full', project.color)} />
						<Typography.Span className='flex-1 text-[11px] text-foreground/85'>{project.name}</Typography.Span>
						<Typography.Span className='text-[10px] text-foreground/40'>{project.count} tasks</Typography.Span>
					</div>
				))}
			</div>
		</div>
	);
}

function NotesCard() {
	return (
		<div className={cn(glass.floating, 'absolute top-[390px] left-5 flex w-[240px] flex-col gap-4 rounded-2xl p-4')}>
			<CardHeader title='Notes' />
			<div className='flex flex-col gap-3'>
				{notes.map(note => (
					<div className='flex items-center gap-2.5' key={note.title}>
						<Icon aria-hidden='true' className='text-foreground/45' icon={FileText} size='xs' />
						<Typography.Span className='flex-1 text-[11px] text-foreground/85'>{note.title}</Typography.Span>
						<Typography.Span className='text-[10px] text-foreground/40'>{note.date}</Typography.Span>
					</div>
				))}
			</div>
		</div>
	);
}

const blocks: readonly { className: string; icon?: LucideIcon; label: string; meta?: string }[] = [
	{ className: 'top-0 h-[64px] bg-white/15', label: 'Deep Work', meta: '2h' },
	{ className: 'top-[74px] h-9 bg-white/[0.08]', icon: Dumbbell, label: 'Gym' },
	{ className: 'top-[120px] h-9 bg-white/[0.08]', icon: BookOpen, label: 'Read' },
];

function AgendaCard() {
	return (
		<div className={cn(glass.floating, 'absolute top-[290px] right-0 flex h-[250px] w-[480px] flex-col gap-3 rounded-2xl p-4')}>
			<div className='flex items-center justify-between'>
				<Typography.Small className='text-xs'>Day agenda</Typography.Small>
				{/* The web app's calendar has a day and a week view. */}
				<ToggleGroup className='rounded-full bg-white/[0.04] p-1' defaultValue='day' size='sm' type='single'>
					{['Day', 'Week'].map(label => (
						<ToggleGroup.Item className='h-6 rounded-full px-4 text-[11px] text-foreground/70 aria-pressed:bg-white/12' key={label} value={label.toLowerCase()}>
							{label}
						</ToggleGroup.Item>
					))}
				</ToggleGroup>
			</div>
			<div className='flex min-h-0 flex-1'>
				<div className='flex w-[200px] shrink-0 flex-col gap-4 border-white/10 border-r pr-4'>
					<CardHeader meta='1 of 3 tasks' title='Plan for today' />
					<TaskList />
					<div className='flex items-center gap-2 text-foreground/35'>
						<Icon aria-hidden='true' icon={Plus} size='xs' />
						<Typography.Span className='text-[11px] text-inherit'>Add task…</Typography.Span>
					</div>
				</div>
				<div className='flex flex-1 gap-3 pl-4'>
					<div className='flex flex-col justify-between py-1'>
						{hours.map(hour => (
							<Typography.Span className='text-[10px] text-foreground/45 tabular-nums' key={hour}>
								{hour}
							</Typography.Span>
						))}
					</div>
					<div className='relative flex-1'>
						{blocks.map(block => (
							<div className={cn('absolute inset-x-0 flex flex-col justify-center rounded-lg px-3', block.className)} key={block.label}>
								<div className='flex items-center gap-2'>
									{block.icon && <Icon aria-hidden='true' className='text-foreground/80' icon={block.icon} size='sm' />}
									<Typography.Span className='text-sm'>{block.label}</Typography.Span>
								</div>
								{block.meta && <Typography.Span className='text-sm'>{block.meta}</Typography.Span>}
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

/**
 * Right side of the hero: a static, non-functional (`inert`) preview of the app (Today window, projects, notes and the day agenda),
 * with the same navigation and copy as `apps/web`. It is laid out on a fixed `CANVAS` and scaled to fit its column; at `xl` it also
 * fits the screen height below the navbar, so it never runs under it.
 */
export default function HeroMockup({ className }: { className?: string }) {
	const ref = useRef<HTMLDivElement>(null);
	const [scale, setScale] = useState<number | null>(null);

	useLayoutEffect(() => {
		const element = ref.current;
		if (!element) return;
		const xl = window.matchMedia('(min-width: 1280px)');
		const update = () => {
			const byWidth = element.clientWidth / CANVAS.width;
			const byHeight = xl.matches ? (window.innerHeight - XL_RESERVED_HEIGHT) / CANVAS.height : Number.POSITIVE_INFINITY;
			setScale(Math.max(0.3, Math.min(1, byWidth, byHeight)));
		};
		update();
		const observer = new ResizeObserver(update);
		observer.observe(element);
		window.addEventListener('resize', update);
		return () => {
			observer.disconnect();
			window.removeEventListener('resize', update);
		};
	}, []);

	const current = scale ?? 1;

	return (
		<div className={cn('w-full select-none', className)} inert ref={ref}>
			<div className={cn('mx-auto xl:mr-0', scale === null && 'invisible')} style={{ height: CANVAS.height * current, width: CANVAS.width * current }}>
				<div className='relative origin-top-left' style={{ height: CANVAS.height, transform: `scale(${current})`, width: CANVAS.width }}>
					<AppWindow />
					<ProjectsCard />
					<NotesCard />
					<AgendaCard />
				</div>
			</div>
		</div>
	);
}
