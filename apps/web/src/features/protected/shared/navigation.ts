import { CircleCheck, CircleDot, FileText, FolderKanban, Inbox, type LucideIcon, Orbit, Tag, Target } from 'lucide-react';
import type { TranslationKey } from '~/i18n';

export interface NavEntry {
	/** Navigation shortcut (a sequence, like Linear's `g i`). */
	hotkey: string;
	icon: LucideIcon;
	/** Key suffix under `protected.nav.*`. */
	id: 'goals' | 'inbox' | 'notes' | 'projects' | 'reflect' | 'tags' | 'tasks' | 'today';
	label: TranslationKey;
	to: string;
}

/** The Flow Cycle stages and the entities of the API, in the order the sidebar shows them (Capture, Process, Today, Reflect + the work they organize). */
export const primaryNav: readonly NavEntry[] = [
	{ hotkey: 'g i', icon: Inbox, id: 'inbox', label: 'protected.nav.inbox', to: '/inbox' },
	{ hotkey: 'g t', icon: CircleDot, id: 'today', label: 'protected.nav.today', to: '/' },
	{ hotkey: 'g p', icon: FolderKanban, id: 'projects', label: 'protected.nav.projects', to: '/projects' },
	{ hotkey: 'g o', icon: Target, id: 'goals', label: 'protected.nav.goals', to: '/goals' },
	{ hotkey: 'g k', icon: CircleCheck, id: 'tasks', label: 'protected.nav.tasks', to: '/tasks' },
	{ hotkey: 'g n', icon: FileText, id: 'notes', label: 'protected.nav.notes', to: '/notes' },
	{ hotkey: 'g r', icon: Orbit, id: 'reflect', label: 'protected.nav.reflect', to: '/reflect' },
];

/** Shown apart, below a divider. */
export const secondaryNav: readonly NavEntry[] = [{ hotkey: 'g l', icon: Tag, id: 'tags', label: 'protected.nav.tags', to: '/tags' }];

export const allNav: readonly NavEntry[] = [...primaryNav, ...secondaryNav];

export function isActive(pathname: string, to: string): boolean {
	return to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`);
}
