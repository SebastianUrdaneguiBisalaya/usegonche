'use client';

import type { CSSProperties, ReactNode } from 'react';
import { Pill } from '@/components/ui/data-display/pill/pill';
import { Progress } from '@/components/ui/data-display/progress/progress';
import { Typography } from '@/components/ui/foundations/typography/typography';
import { cn } from '@/components/ui/utils/tailwind/cn';

/** Unchecked boxes are soft grey squares, checked ones white, like the app. */
export const checkboxClass = 'size-3.5 rounded-[4px] data-[state=unchecked]:border-transparent data-[state=unchecked]:bg-white/15';

/** Title and optional counter at the top of a mockup card. */
export function CardHeader({ title, meta }: { title: string; meta?: string }) {
	return (
		<div className='flex items-center justify-between'>
			<Typography.Small className='text-xs'>{title}</Typography.Small>
			{meta && <Typography.Span className='text-[10px] text-foreground/45'>{meta}</Typography.Span>}
		</div>
	);
}

/** The app's `Progress` line (capacity, plan, project and subtask progress). `value` is 0–100. */
export function ProgressBar({ className, value }: { className?: string; value: number }) {
	return (
		<Progress value={value}>
			<Progress.Indicator className={cn('h-1.5', className)} />
		</Progress>
	);
}

interface ScaledCanvasProps {
	children: ReactNode;
	className?: string;
	/** Classes of the scaled box (its alignment inside the column). */
	frameClassName?: string;
	/** Design height of the canvas (px). */
	height: number;
	/** Design width of the canvas (px). */
	width: number;
	/** At `xl`, the canvas also fits the screen height minus this many px (the hero, which is exactly one screen tall). */
	xlReservedHeight?: number;
}

/** Smallest scale of a canvas; below it the frame overflows its column instead of shrinking further. */
const MIN_SCALE = 0.3;

/**
 * A static, non-functional (`inert`) app preview: its cards are laid out on a fixed canvas and scaled down to fit the column, so the
 * composition stays the same on every screen.
 *
 * Pure CSS, no JS: the server-rendered HTML is already final, so the preview neither starts empty nor pops in after hydration.
 * - The frame's size is a clamped width plus `aspect-ratio`.
 * - The frame is a size container and the cards scale by `frame width / design width`. CSS can't divide two lengths into a number
 *   directly, so the ratio is computed as `tan(atan2(100cqw, <width>px))` (atan2 takes two lengths, tan returns a plain number).
 */
export function ScaledCanvas({ children, className, frameClassName, height, width, xlReservedHeight }: ScaledCanvasProps) {
	const frameStyle = {
		'--canvas-min': `${width * MIN_SCALE}px`,
		'--canvas-w': `${width}px`,
		// Width that makes the canvas fit the screen height minus `xlReservedHeight` (only applied at `xl`).
		'--canvas-xl': xlReservedHeight === undefined ? `${width}px` : `calc((100vh - ${xlReservedHeight}px) * ${width / height})`,
		aspectRatio: `${width} / ${height}`,
	} as CSSProperties;

	return (
		<div className={cn('w-full select-none', className)} inert>
			<div
				className={cn('@container mx-auto w-[max(var(--canvas-min),min(100%,var(--canvas-w)))] xl:w-[max(var(--canvas-min),min(100%,var(--canvas-w),var(--canvas-xl)))]', frameClassName)}
				style={frameStyle}
			>
				<div className='relative origin-top-left' style={{ height, transform: `scale(tan(atan2(100cqw, ${width}px)))`, width }}>
					{children}
				</div>
			</div>
		</div>
	);
}

export type Priority = 'high' | 'low' | 'medium' | 'urgent';

/** Same priority colors as the web app (`tasks/display.tsx`): low and medium are quiet, high and urgent grow louder. */
const priorityClass: Record<Priority, string> = {
	high: 'border-transparent bg-warning/15 text-warning',
	low: 'border-transparent bg-white/10 text-foreground/60',
	medium: 'border-transparent bg-chart-2/15 text-chart-2',
	urgent: 'border-transparent bg-destructive/10 text-destructive',
};

const priorityLabel: Record<Priority, string> = { high: 'High', low: 'Low', medium: 'Medium', urgent: 'Urgent' };

export function PriorityPill({ className, priority }: { className?: string; priority: Priority }) {
	return (
		<Pill className={cn('px-2 py-0.5', priorityClass[priority])}>
			<Pill.Text className={cn('text-[9px]', className)}>{priorityLabel[priority]}</Pill.Text>
		</Pill>
	);
}
