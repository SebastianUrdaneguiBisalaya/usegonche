'use client';

import { type ReactNode, useLayoutEffect, useRef, useState } from 'react';
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

/**
 * A static, non-functional (`inert`) app preview: its cards are laid out on a fixed canvas and scaled down to fit the column, so the
 * composition stays the same on every screen. It is hidden until the first measure, so it never flashes at the wrong size.
 */
export function ScaledCanvas({ children, className, frameClassName, height, width, xlReservedHeight }: ScaledCanvasProps) {
	const ref = useRef<HTMLDivElement>(null);
	const [scale, setScale] = useState<number | null>(null);

	useLayoutEffect(() => {
		const element = ref.current;
		if (!element) return;
		const xl = window.matchMedia('(min-width: 1280px)');
		const update = () => {
			const byWidth = element.clientWidth / width;
			const byHeight = xlReservedHeight !== undefined && xl.matches ? (window.innerHeight - xlReservedHeight) / height : Number.POSITIVE_INFINITY;
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
	}, [height, width, xlReservedHeight]);

	const current = scale ?? 1;

	return (
		<div className={cn('w-full select-none', className)} inert ref={ref}>
			<div className={cn('mx-auto', frameClassName, scale === null && 'invisible')} style={{ height: height * current, width: width * current }}>
				<div className='relative origin-top-left' style={{ height, transform: `scale(${current})`, width }}>
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
