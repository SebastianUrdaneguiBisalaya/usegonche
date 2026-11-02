import { Archive, Award, BookOpen, Circle, CircleCheck, Compass, Flag, Gem, Lightbulb, type LucideIcon, Rocket, Target, Trophy } from 'lucide-react';
import { pickBy } from '../shared/display';
import type { StatusLook } from '../shared/status-pill';
import type { GoalTab } from './search-params';

/** What a goal is shown as: its status, or `archived` once it is archived. */
export type DisplayStatus = GoalTab;

export const statusIcon: Record<DisplayStatus, LucideIcon> = {
	achieved: CircleCheck,
	active: Circle,
	archived: Archive,
};

/** Color of the icon of each status, on theme tokens so it reads in light and dark. */
export const statusColor: Record<DisplayStatus, string> = {
	achieved: 'text-chart-1',
	active: 'text-success',
	archived: 'text-muted-foreground',
};

export const statusDot: Record<DisplayStatus, string> = {
	achieved: 'bg-chart-1',
	active: 'bg-success',
	archived: 'bg-muted-foreground',
};

/** The pill of a status: a dot, or a check for the achieved ones. */
export const statusLook = (status: DisplayStatus, label: string): StatusLook =>
	status === 'achieved' ? { icon: CircleCheck, iconClassName: statusColor.achieved, label } : { dotClassName: statusDot[status], label };

export const displayStatus = (goal: { archivedAt: string | null; status: Exclude<DisplayStatus, 'archived'> }): DisplayStatus => (goal.archivedAt ? 'archived' : goal.status);

const GOAL_ICONS: readonly LucideIcon[] = [Target, Flag, Trophy, Rocket, Compass, Award, Gem, Lightbulb, BookOpen];

/** Goals have no icon of their own: it is picked from the id, so it stays the same everywhere. */
export const goalIcon = (id: string): LucideIcon => pickBy(GOAL_ICONS, id, Target);

/** Today as `YYYY-MM-DD` in the user's calendar. */
export const todayDateOnly = (now: Date = new Date()): string => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

/** An active goal whose target date has passed. `targetDate` is the API's date column; the comparison is between calendar days. */
export const isOverdue = (goal: { archivedAt: string | null; status: string; targetDate: string | null }, today: string = todayDateOnly()): boolean =>
	goal.status === 'active' && !goal.archivedAt && goal.targetDate !== null && goal.targetDate.slice(0, 10) < today;
