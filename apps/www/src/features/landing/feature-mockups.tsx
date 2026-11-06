'use client';

import {
	Archive,
	ArrowRight,
	Bell,
	CalendarDays,
	CircleAlert,
	CircleCheck,
	Dumbbell,
	FileText,
	FolderKanban,
	Hourglass,
	Layers,
	ListChecks,
	type LucideIcon,
	OctagonAlert,
	Plus,
	RefreshCw,
	Repeat,
	Target,
	Zap,
} from 'lucide-react';
import { ToggleGroup } from '@/components/ui/actions-controls/toggle-group/toggle-group';
import { Pill } from '@/components/ui/data-display/pill/pill';
import { Checkbox } from '@/components/ui/forms-inputs/checkbox/checkbox';
import { Icon } from '@/components/ui/foundations/icon/icon';
import { Typography } from '@/components/ui/foundations/typography/typography';
import { cn } from '@/components/ui/utils/tailwind/cn';
import { glass } from '@/styles/glass';
import { CardHeader, checkboxClass, type Priority, PriorityPill, ProgressBar, ScaledCanvas } from './mockup';

/** Two-option segmented control, like the web app's view toggles (Day / Week, Daily / Weekly). */
function Segmented({ options, value }: { options: readonly string[]; value: string }) {
	return (
		<ToggleGroup className='rounded-full bg-white/[0.04] p-1' defaultValue={value} size='sm' type='single'>
			{options.map(label => (
				<ToggleGroup.Item className='h-6 rounded-full px-3.5 text-[11px] text-foreground/70 aria-pressed:bg-white/12' key={label} value={label}>
					{label}
				</ToggleGroup.Item>
			))}
		</ToggleGroup>
	);
}

/* ------------------------------------------------------------------ Plan */

const planTasks: readonly { done: boolean; label: string; priority: Priority }[] = [
	{ done: true, label: 'Finish landing page design', priority: 'high' },
	{ done: false, label: 'Write weekly report', priority: 'urgent' },
	{ done: false, label: 'Workout at the gym', priority: 'low' },
	{ done: false, label: 'Read 20 pages', priority: 'medium' },
];

const agendaHours = ['08:00', '10:00', '12:00', '14:00', '16:00'] as const;

/** Time blocks of the day agenda; `top`/`height` are px on a 2h = 44px scale starting at 08:00. */
const agendaBlocks: readonly { height: number; icon: LucideIcon; label: string; meta: string; top: number }[] = [
	{ height: 44, icon: Zap, label: 'Deep work', meta: '2h', top: 0 },
	{ height: 33, icon: FileText, label: 'Write weekly report', meta: '1h 30m', top: 88 },
	{ height: 22, icon: Dumbbell, label: 'Gym', meta: '1h', top: 154 },
];

const events = [
	{ label: 'Team sync', time: '11:00 – 11:30' },
	{ label: 'Dentist', time: '17:30 – 18:15' },
] as const;

function CapacityCard() {
	return (
		<div className={cn(glass.floating, 'absolute top-0 left-0 flex w-[400px] flex-col gap-2.5 rounded-2xl p-4')}>
			<div className='flex items-center justify-between'>
				<Typography.Small className='text-xs'>Capacity</Typography.Small>
				<Typography.Span className='text-[10px] text-foreground/55 tabular-nums'>4h 30m planned of 6h available</Typography.Span>
			</div>
			<ProgressBar value={75} />
			<Typography.Span className='text-[10px] text-foreground/45'>1h 30m left</Typography.Span>
		</div>
	);
}

function PlanCard() {
	return (
		<div className={cn(glass.floating, 'absolute top-[104px] left-0 flex h-[220px] w-[400px] flex-col gap-4 rounded-2xl p-4')}>
			<CardHeader meta='1 of 4 tasks' title='Plan for today' />
			<Typography.List className='my-0 ml-0 flex list-none flex-col gap-3 [&>li]:mt-0'>
				{planTasks.map(task => (
					<li className='flex items-center justify-between gap-3' key={task.label}>
						<Checkbox defaultChecked={task.done}>
							<Checkbox.Toggle className={checkboxClass} />
							<Checkbox.Label className={cn('font-normal text-[11px]', task.done ? 'text-foreground/45 line-through' : 'text-foreground/85')}>{task.label}</Checkbox.Label>
						</Checkbox>
						<PriorityPill priority={task.priority} />
					</li>
				))}
			</Typography.List>
			<div className='mt-auto flex items-center gap-2 text-foreground/35'>
				<Icon aria-hidden='true' icon={Plus} size='xs' />
				<Typography.Span className='text-[11px] text-inherit'>Add task…</Typography.Span>
			</div>
		</div>
	);
}

function DayAgendaCard() {
	return (
		<div className={cn(glass.floating, 'absolute top-0 right-0 flex h-[250px] w-[340px] flex-col gap-4 rounded-2xl p-4')}>
			<div className='flex items-center justify-between'>
				<Typography.Small className='text-xs'>Day agenda</Typography.Small>
				<Segmented options={['Day', 'Week']} value='Day' />
			</div>
			<div className='flex flex-1 gap-3'>
				<div className='flex flex-col justify-between'>
					{agendaHours.map(hour => (
						<Typography.Span className='text-[10px] text-foreground/45 tabular-nums leading-none' key={hour}>
							{hour}
						</Typography.Span>
					))}
				</div>
				<div className='relative flex-1'>
					{agendaBlocks.map(block => (
						<div className='absolute inset-x-0 flex items-center justify-between gap-2 rounded-lg bg-white/[0.09] px-3' key={block.label} style={{ height: block.height, top: block.top }}>
							<span className='flex min-w-0 items-center gap-2'>
								<Icon aria-hidden='true' className='shrink-0 text-foreground/75' icon={block.icon} size='xs' />
								<Typography.Span className='truncate text-[11px]'>{block.label}</Typography.Span>
							</span>
							<Typography.Span className='shrink-0 text-[9px] text-foreground/45 tabular-nums'>{block.meta}</Typography.Span>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

/** Calendar events of the day: they count against its capacity. */
function EventsCard() {
	return (
		<div className={cn(glass.floating, 'absolute top-[264px] right-0 flex w-[340px] flex-col gap-3 rounded-2xl p-4')}>
			<CardHeader meta='2 events' title='Events' />
			<div className='flex flex-col gap-1.5'>
				{events.map(event => (
					<div className='flex items-center justify-between gap-3 rounded-xl border border-white/10 px-3 py-2' key={event.label}>
						<Typography.Span className='font-medium text-[11px]'>{event.label}</Typography.Span>
						<Typography.Span className='text-[10px] text-foreground/45 tabular-nums'>{event.time}</Typography.Span>
					</div>
				))}
			</div>
		</div>
	);
}

/** The task drawer: its repeat rule, subtasks, dependencies, an open blocker and a reminder. */
function TaskDetailCard() {
	return (
		<div className={cn(glass.floating, 'absolute top-[300px] left-[40px] flex w-[400px] flex-col gap-3.5 rounded-2xl p-4')}>
			<div className='flex items-center justify-between gap-3'>
				<Typography.Small className='text-sm'>Write weekly report</Typography.Small>
				<PriorityPill priority='urgent' />
			</div>
			<div className='flex items-center gap-4 text-foreground/55'>
				<span className='flex items-center gap-1.5'>
					<Icon aria-hidden='true' icon={Repeat} size='xs' />
					<Typography.Span className='text-[10px] text-inherit'>Every week on Fri</Typography.Span>
				</span>
				<span className='flex items-center gap-1.5'>
					<Icon aria-hidden='true' icon={Hourglass} size='xs' />
					<Typography.Span className='text-[10px] text-inherit'>Waits for 1 task</Typography.Span>
				</span>
				<span className='flex items-center gap-1.5'>
					<Icon aria-hidden='true' icon={Bell} size='xs' />
					<Typography.Span className='text-[10px] text-inherit'>Today, 16:00</Typography.Span>
				</span>
			</div>
			<div className='flex flex-col gap-1.5'>
				<Typography.Span className='text-[11px] text-foreground/80'>Subtasks (2 / 3)</Typography.Span>
				<ProgressBar className='h-1' value={67} />
			</div>
			<div className='flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2'>
				<span className='flex items-center gap-2'>
					<Icon aria-hidden='true' className='text-destructive' icon={OctagonAlert} size='xs' />
					<Typography.Span className='text-[11px]'>Waiting for the sales numbers</Typography.Span>
				</span>
				<Typography.Span className='text-[10px] text-foreground/50'>Recurring ×2</Typography.Span>
			</div>
		</div>
	);
}

/** Today: capacity, the plan for the day, the day agenda with time blocks, the day's events and the detail of one recurring task. */
export function PlanMockup({ className }: { className?: string }) {
	return (
		<ScaledCanvas className={className} height={480} width={760}>
			<CapacityCard />
			<PlanCard />
			<DayAgendaCard />
			<EventsCard />
			<TaskDetailCard />
		</ScaledCanvas>
	);
}

/* --------------------------------------------------------------- Capture */

const inboxRows: readonly { content: string; source: 'braindump' | 'quick'; time: string }[] = [
	{ content: 'Plan a trip to Cusco in March', source: 'quick', time: '2m ago' },
	{ content: 'Read “Deep Work” notes again', source: 'braindump', time: '1h ago' },
	{ content: 'Redesign the personal website', source: 'braindump', time: '1h ago' },
	{ content: 'Call the bank about the card', source: 'quick', time: 'Yesterday' },
];

const inboxTabs = [
	{ count: 4, label: 'Pending' },
	{ count: 12, label: 'Archived' },
	{ count: 3, label: 'Discarded' },
	{ count: 28, label: 'Converted' },
] as const;

function InboxWindow() {
	return (
		<div className={cn(glass.floating, 'absolute top-0 left-0 flex h-[392px] w-[560px] flex-col gap-4 rounded-2xl p-5')}>
			<div className='flex items-start justify-between gap-4'>
				<div className='flex flex-col gap-1'>
					<Typography.Small className='text-base'>Inbox</Typography.Small>
					<Typography.Span className='text-[10px] text-foreground/50'>Capture anything, organize later.</Typography.Span>
				</div>
				<div className='flex h-8 w-[250px] items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-foreground/40'>
					<Icon aria-hidden='true' icon={Plus} size='xs' />
					<Typography.Span className='truncate text-[10px] text-inherit'>Quick capture... (tasks, ideas, notes, reminders)</Typography.Span>
				</div>
			</div>
			<div className={cn(glass.card, 'flex items-center justify-between gap-3 rounded-xl px-4 py-3')}>
				<div className='flex items-center gap-3'>
					<Icon aria-hidden='true' icon={Layers} size='md' />
					<div className='flex flex-col gap-0.5'>
						<Typography.Span className='font-medium text-[11px]'>Brain Dump</Typography.Span>
						<Typography.Span className='text-[10px] text-foreground/50'>Paste multiple ideas, one per line.</Typography.Span>
					</div>
				</div>
				<span className='flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5'>
					<Typography.Span className='text-[10px]'>Open Brain Dump</Typography.Span>
					<Icon aria-hidden='true' icon={ArrowRight} size='xs' />
				</span>
			</div>
			<div className='flex gap-2'>
				{inboxTabs.map(tab => (
					<span className={cn('flex h-7 items-center gap-2 rounded-full border px-3', tab.label === 'Pending' ? 'border-white/20 bg-white/[0.06]' : 'border-white/10')} key={tab.label}>
						<Typography.Span className='text-[10px]'>{tab.label}</Typography.Span>
						<span className='rounded-full bg-white/10 px-1.5 text-[9px] tabular-nums'>{tab.count}</span>
					</span>
				))}
			</div>
			<div className={cn(glass.card, 'flex flex-col divide-y divide-white/[0.06] rounded-xl')}>
				{inboxRows.map((row, i) => (
					<div className='flex items-center gap-3 px-4 py-2.5' key={row.content}>
						<Typography.Span className='min-w-0 flex-1 truncate text-[11px] text-foreground/85'>{row.content}</Typography.Span>
						<Pill className='px-2 py-0.5'>
							<Pill.Text className='text-[9px]'>{row.source}</Pill.Text>
						</Pill>
						<Typography.Span className='w-14 text-right text-[10px] text-foreground/45'>{row.time}</Typography.Span>
						<span className='flex items-center gap-2.5 text-foreground/45'>
							<span className={cn('flex size-5 items-center justify-center rounded-full', i === 0 && 'bg-white/12 text-foreground')}>
								<Icon aria-hidden='true' icon={RefreshCw} size='xs' />
							</span>
							<Icon aria-hidden='true' icon={Archive} size='xs' />
						</span>
					</div>
				))}
			</div>
		</div>
	);
}

/** The "Convert" menu of the first inbox row. */
function ConvertMenu() {
	return (
		<div className={cn(glass.floating, 'absolute top-[268px] left-[430px] flex w-[150px] flex-col gap-0.5 rounded-xl p-1.5')}>
			{['To task', 'To project', 'To note'].map((label, i) => (
				<span className={cn('rounded-lg px-2.5 py-1.5', i === 0 && 'bg-white/10')} key={label}>
					<Typography.Span className='text-[11px]'>{label}</Typography.Span>
				</span>
			))}
		</div>
	);
}

/** A project's drawer: its goal, tags, progress and sections. */
function ProjectCard() {
	return (
		<div className={cn(glass.floating, 'absolute top-[300px] right-0 flex w-[380px] flex-col gap-3.5 rounded-2xl p-4')}>
			<div className='flex items-center justify-between gap-3'>
				<span className='flex items-center gap-2'>
					<Icon aria-hidden='true' className='text-foreground/70' icon={FolderKanban} size='sm' />
					<Typography.Small className='text-sm'>Personal website</Typography.Small>
				</span>
				<Pill className='px-2 py-0.5' variant='success'>
					<Pill.Dot />
					<Pill.Text className='text-[9px]'>Active</Pill.Text>
				</Pill>
			</div>
			<div className='flex flex-wrap items-center gap-1.5'>
				<Pill className='px-2 py-0.5' variant='outline'>
					<Icon aria-hidden='true' icon={Target} size='xs' />
					<Pill.Text className='text-[9px]'>Launch my portfolio</Pill.Text>
				</Pill>
				{['design', 'side project'].map(tag => (
					<Pill className='px-2 py-0.5' key={tag}>
						<Pill.Text className='text-[9px]'>#{tag}</Pill.Text>
					</Pill>
				))}
			</div>
			<div className='flex flex-col gap-1.5'>
				<ProgressBar className='h-1' value={67} />
				<Typography.Span className='text-[10px] text-foreground/50'>8 of 12 tasks done</Typography.Span>
			</div>
			<div className='flex gap-4 border-white/10 border-t pt-3'>
				{['Details', 'Tasks', 'Notes', 'Files'].map(tab => (
					<Typography.Span className={cn('text-[10px]', tab === 'Notes' ? 'text-foreground' : 'text-foreground/45')} key={tab}>
						{tab}
					</Typography.Span>
				))}
			</div>
		</div>
	);
}

/** Inbox: quick capture, Brain Dump, the status tabs and items, the convert menu, and the project an item became. */
export function CaptureMockup({ className }: { className?: string }) {
	return (
		<ScaledCanvas className={className} height={490} width={760}>
			<InboxWindow />
			<ConvertMenu />
			<ProjectCard />
		</ScaledCanvas>
	);
}

/* --------------------------------------------------------------- Reflect */

const decisionActions = ['Carry over', 'Reschedule', 'Drop', 'Keep'] as const;

const decisions: readonly { choice?: (typeof decisionActions)[number]; priority: Priority; title: string }[] = [
	{ choice: 'Carry over', priority: 'high', title: 'Write project proposal' },
	{ choice: 'Drop', priority: 'low', title: 'Clean up old notes' },
	{ priority: 'medium', title: 'Read 20 pages' },
];

const RING_RADIUS = 20;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function Stat({ label, value }: { label: string; value: number }) {
	return (
		<div className='flex flex-col gap-0.5'>
			<Typography.Span className='font-medium text-xl tabular-nums'>{value}</Typography.Span>
			<Typography.Span className='text-[10px] text-foreground/50'>{label}</Typography.Span>
		</div>
	);
}

function PeriodBar() {
	const rate = 78;
	return (
		<div className={cn(glass.floating, 'absolute top-0 left-0 flex w-[760px] items-center gap-9 rounded-2xl px-5 py-4')}>
			<div className='flex items-center gap-3'>
				<span className='flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]'>
					<Icon aria-hidden='true' className='text-foreground/60' icon={CalendarDays} size='sm' />
				</span>
				<div className='flex flex-col'>
					<Typography.Span className='font-medium text-xs'>This period</Typography.Span>
					<Typography.Span className='text-[10px] text-foreground/50'>Nov 2 – Nov 8, 2026</Typography.Span>
				</div>
			</div>
			<Stat label='Planned' value={18} />
			<Stat label='Completed' value={14} />
			<Stat label='Pending' value={4} />
			<div className='ml-auto flex items-center gap-3'>
				<svg aria-hidden className='-rotate-90 size-11' viewBox='0 0 48 48'>
					<circle className='stroke-white/10' cx='24' cy='24' fill='none' r={RING_RADIUS} strokeWidth='4' />
					<circle
						className='stroke-success'
						cx='24'
						cy='24'
						fill='none'
						r={RING_RADIUS}
						strokeDasharray={RING_CIRCUMFERENCE}
						strokeDashoffset={RING_CIRCUMFERENCE * (1 - rate / 100)}
						strokeLinecap='round'
						strokeWidth='4'
					/>
				</svg>
				<div className='flex flex-col'>
					<Typography.Span className='font-medium text-xl tabular-nums'>{rate}%</Typography.Span>
					<Typography.Span className='text-[10px] text-foreground/50'>Completion rate</Typography.Span>
				</div>
			</div>
			<Segmented options={['Daily', 'Weekly']} value='Weekly' />
		</div>
	);
}

function DecisionsCard() {
	return (
		<div className={cn(glass.floating, 'absolute top-[100px] left-0 flex w-[490px] flex-col gap-3 rounded-2xl p-4')}>
			<div className='flex items-start justify-between gap-3'>
				<div className='flex flex-col gap-1'>
					<span className='flex items-center gap-2'>
						<Icon aria-hidden='true' className='text-foreground/60' icon={ListChecks} size='sm' />
						<Typography.Small className='text-sm'>Decisions</Typography.Small>
					</span>
					<Typography.Span className='text-[10px] text-foreground/50'>Review your pending tasks and decide what to do.</Typography.Span>
				</div>
				<span className='rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5'>
					<Typography.Span className='text-[10px]'>Apply decisions (2)</Typography.Span>
				</span>
			</div>
			<div className='flex flex-col divide-y divide-white/[0.06] border-white/[0.06] border-t'>
				{decisions.map(row => (
					<div className='flex flex-col gap-2 py-2.5' key={row.title}>
						<div className='flex items-center gap-2.5'>
							<Checkbox defaultChecked={Boolean(row.choice)}>
								<Checkbox.Toggle className={checkboxClass} />
								<Checkbox.Label className='font-medium text-[11px]'>{row.title}</Checkbox.Label>
							</Checkbox>
							<PriorityPill priority={row.priority} />
						</div>
						<div className='flex items-center gap-1 pl-6'>
							{decisionActions.map(action => (
								<span className={cn('flex items-center gap-1 rounded-full px-2.5 py-1 text-foreground/70', row.choice === action && 'bg-white/12 text-foreground')} key={action}>
									{(action === 'Carry over' || action === 'Reschedule') && <Icon aria-hidden='true' icon={CalendarDays} size='xs' />}
									<Typography.Span className='text-[10px] text-inherit'>{action}</Typography.Span>
								</span>
							))}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

function SummaryCard() {
	return (
		<div className={cn(glass.floating, 'absolute top-[100px] right-0 flex w-[254px] flex-col gap-3.5 rounded-2xl p-4')}>
			<Typography.Small className='text-sm'>Review summary</Typography.Small>
			<div className='flex flex-col gap-2.5'>
				<div className='flex items-center justify-between'>
					<span className='flex items-center gap-2'>
						<Icon aria-hidden='true' className='text-success' icon={CircleCheck} size='sm' />
						<Typography.Span className='text-[11px]'>On track</Typography.Span>
					</span>
					<Typography.Span className='text-[11px] text-foreground/50 tabular-nums'>14 / 18</Typography.Span>
				</div>
				<div className='flex items-center justify-between'>
					<span className='flex items-center gap-2'>
						<Icon aria-hidden='true' className='text-warning' icon={CircleAlert} size='sm' />
						<Typography.Span className='text-[11px]'>Overdue</Typography.Span>
					</span>
					<Typography.Span className='text-[11px] text-foreground/50 tabular-nums'>2</Typography.Span>
				</div>
			</div>
			<div className='flex flex-col gap-2 border-white/10 border-t pt-3'>
				<div className='flex items-center justify-between'>
					<span className='flex items-center gap-2'>
						<Icon aria-hidden='true' className='text-foreground/60' icon={RefreshCw} size='sm' />
						<Typography.Span className='font-medium text-[11px]'>Recurring blockers</Typography.Span>
					</span>
					<span className='flex size-5 items-center justify-center rounded-full bg-white/10 text-[10px] tabular-nums'>2</span>
				</div>
				{[
					{ count: 3, reason: 'Waiting for feedback' },
					{ count: 2, reason: 'Unclear requirements' },
				].map(blocker => (
					<div className='flex items-center justify-between text-foreground/50' key={blocker.reason}>
						<Typography.Span className='text-[10px] text-inherit'>{blocker.reason}</Typography.Span>
						<Typography.Span className='text-[10px] text-inherit tabular-nums'>×{blocker.count}</Typography.Span>
					</div>
				))}
			</div>
		</div>
	);
}

function NextFocusCard() {
	return (
		<div className={cn(glass.floating, 'absolute top-[296px] right-0 flex w-[254px] flex-col gap-2 rounded-2xl p-4')}>
			<Typography.Small className='text-sm'>Next focus</Typography.Small>
			<Typography.Span className='text-[11px] text-foreground/75 leading-relaxed'>Ship the proposal and block two mornings for deep work.</Typography.Span>
		</div>
	);
}

/** Reflect: the period figures, the decisions on pending tasks, the review summary with recurring blockers and the next focus. */
export function ReflectMockup({ className }: { className?: string }) {
	return (
		<ScaledCanvas className={className} height={420} width={760}>
			<PeriodBar />
			<DecisionsCard />
			<SummaryCard />
			<NextFocusCard />
		</ScaledCanvas>
	);
}
