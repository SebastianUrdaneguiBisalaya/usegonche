'use client';

import { BookOpen, Calendar, ChevronRight, CircleCheck, CircleDot, Dumbbell, FileText, FolderKanban, Inbox, type LucideIcon, Orbit, Plus, Search, Target } from 'lucide-react';
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
import { AppWindow, MiniMonth, TaskList } from './app-window';
import { CardHeader, ScaledCanvas } from './mockup';

/** Design size of the mockup canvas (px). It is drawn at this size and scaled down to fit its column. */
const CANVAS = { height: 550, width: 800 } as const;

/** Vertical room the floating navbar and the section padding take at `xl`, where the hero is exactly one screen tall. */
const XL_RESERVED_HEIGHT = 200;

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

function ProjectsCard() {
	return (
		<div className={cn(glass.floating, 'absolute top-[170px] left-5 flex w-[240px] flex-col gap-4 rounded-2xl p-4')} data-motion='surface'>
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
		<div className={cn(glass.floating, 'absolute top-[390px] left-5 flex w-[240px] flex-col gap-4 rounded-2xl p-4')} data-motion='surface'>
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
		<div className={cn(glass.floating, 'absolute top-[290px] right-0 flex h-[250px] w-[480px] flex-col gap-3 rounded-2xl p-4')} data-motion='surface'>
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
	return (
		<ScaledCanvas className={className} frameClassName='xl:mr-0' height={CANVAS.height} width={CANVAS.width} xlReservedHeight={XL_RESERVED_HEIGHT}>
			<div className='absolute top-0 right-0 h-[340px] w-[570px]' data-motion='surface'>
				<AppWindow className={cn(glass.floating, 'h-full w-full')}>
					<div className='flex flex-1 gap-3'>
						<div className={cn(glass.card, 'flex min-w-0 flex-1 flex-col gap-4 p-3')}>
							<CardHeader meta='1 of 3 tasks' title='Plan for today' />
							<TaskList />
						</div>
						<MiniMonth />
					</div>
				</AppWindow>
			</div>
			<ProjectsCard />
			<NotesCard />
			<AgendaCard />
		</ScaledCanvas>
	);
}
