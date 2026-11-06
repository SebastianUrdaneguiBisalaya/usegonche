'use client';

import { type ReactNode, useRef } from 'react';
import { type SectionMotionOptions, useSectionMotion } from './use-section-motion';

/** Client wrapper that gives server-rendered content the section motion (for example the footer). */
export function MotionScope({ children, className, ...options }: { children: ReactNode; className?: string } & SectionMotionOptions) {
	const ref = useRef<HTMLDivElement>(null);
	useSectionMotion(ref, options);
	return (
		<div className={className} ref={ref}>
			{children}
		</div>
	);
}
