import { Archive, BarChart3, Box, Building2, Circle, CircleCheck, FlaskConical, Landmark, type LucideIcon, Paintbrush, Pause, Rocket, ShieldCheck } from 'lucide-react';
import { pickBy } from '../shared/display';
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

const PROJECT_ICONS: readonly LucideIcon[] = [BarChart3, Landmark, ShieldCheck, Paintbrush, Building2, FlaskConical, Rocket, Box];

/** Projects have no icon of their own: it is picked from the id, so it stays the same everywhere. */
export const projectIcon = (id: string): LucideIcon => pickBy(PROJECT_ICONS, id, Box);
