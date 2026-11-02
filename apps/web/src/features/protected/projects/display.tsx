import { Archive, BarChart3, Box, Building2, Circle, CircleCheck, FlaskConical, Landmark, type LucideIcon, Paintbrush, Pause, Rocket, ShieldCheck } from 'lucide-react';
import type { TagColor } from '~/components/ui/data-display/tag/tag';
import type { ProjectTab } from './search-params';

/** What a project is shown as: its status, or `archived` once it is archived. */
export type DisplayStatus = ProjectTab;

export const statusIcon: Record<DisplayStatus, LucideIcon> = {
	active: Circle,
	archived: Archive,
	completed: CircleCheck,
	on_hold: Pause,
};

/** Color of the dot (and the tab icon) of each status, on theme tokens so it reads in light and dark. */
export const statusColor: Record<DisplayStatus, string> = {
	active: 'text-success',
	archived: 'text-muted-foreground',
	completed: 'text-chart-5',
	on_hold: 'text-chart-1',
};
export const statusDot: Record<DisplayStatus, string> = {
	active: 'bg-success',
	archived: 'bg-muted-foreground',
	completed: 'bg-chart-5',
	on_hold: 'bg-chart-1',
};

export const displayStatus = (project: { archivedAt: string | null; status: Exclude<DisplayStatus, 'archived'> }): DisplayStatus => (project.archivedAt ? 'archived' : project.status);

const hash = (text: string): number => {
	let value = 0;
	for (const char of text) value = (value * 31 + char.codePointAt(0)!) >>> 0;
	return value;
};

const TAG_COLORS: readonly TagColor[] = ['blue', 'green', 'amber', 'rose', 'violet', 'teal'];

/** Tags have no color of their own: each name always gets the same one, so a tag reads the same on every row. */
export const tagColor = (name: string): TagColor => TAG_COLORS[hash(name.toLowerCase()) % TAG_COLORS.length] ?? 'default';

const PROJECT_ICONS: readonly LucideIcon[] = [BarChart3, Landmark, ShieldCheck, Paintbrush, Building2, FlaskConical, Rocket, Box];

/** Projects have no icon of their own: it is picked from the id, so it stays the same everywhere. */
export const projectIcon = (id: string): LucideIcon => PROJECT_ICONS[hash(id) % PROJECT_ICONS.length] ?? Box;

/** Markdown reduced to plain text for a one-line preview (headings, emphasis, links and list markers dropped). */
export const plainText = (markdown: string | null): string =>
	(markdown ?? '')
		.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/[`*_~>#]+/g, '')
		.replace(/^\s*[-+]\s+/gm, '')
		.replace(/\s+/g, ' ')
		.trim();
