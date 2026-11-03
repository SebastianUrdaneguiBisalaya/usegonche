import { Ban, Bug, CalendarDays, ChartNoAxesColumn, CheckCircle2, Circle, CircleDashed, CircleDot, CircleX, Database, FileText, type LucideIcon, Package, PenLine, Scale, Wrench } from 'lucide-react';
import { pickBy } from '../shared/display';
import type { TaskPriority, TaskStatus } from './search-params';

export const statusIcon: Record<TaskStatus, LucideIcon> = {
	cancelled: CircleX,
	done: CheckCircle2,
	in_progress: CircleDot,
	todo: Circle,
};

/** Color of the dot (and the chip icon) of each status, on theme tokens so it reads in light and dark. */
export const statusColor: Record<TaskStatus, string> = {
	cancelled: 'text-muted-foreground',
	done: 'text-success',
	in_progress: 'text-chart-2',
	todo: 'text-foreground',
};
export const statusDot: Record<TaskStatus, string> = {
	cancelled: 'bg-muted-foreground',
	done: 'bg-success',
	in_progress: 'bg-chart-2',
	todo: 'bg-foreground/60',
};

/** Classes of a priority pill: low and medium are quiet, high and urgent grow louder. */
export const priorityClass: Record<TaskPriority, string> = {
	high: 'border-transparent bg-warning/15 text-warning',
	low: 'border-transparent bg-muted text-muted-foreground',
	medium: 'border-transparent bg-chart-2/15 text-chart-2',
	urgent: 'border-transparent bg-destructive/10 text-destructive',
};
export const priorityDot: Record<TaskPriority, string> = {
	high: 'bg-warning',
	low: 'bg-muted-foreground',
	medium: 'bg-chart-2',
	urgent: 'bg-destructive',
};

/** Tasks have no icon of their own: it is picked from the id, so it stays the same everywhere (like projects). */
const TASK_ICONS: readonly LucideIcon[] = [Scale, ChartNoAxesColumn, Database, Bug, CalendarDays, Package, PenLine, FileText, Wrench, CircleDashed, Ban];
export const taskIcon = (id: string): LucideIcon => pickBy(TASK_ICONS, id, FileText);

const DAY_MS = 86_400_000;

/** Whole days from `today` to a due date, both `YYYY-MM-DD` (calendar days: `today` comes from the user's stored time zone): negative when it is past. */
export const daysUntil = (dateOnly: string, today: string): number => {
	const [year, month, day] = dateOnly.split('-').map(Number);
	const [todayYear, todayMonth, todayDay] = today.split('-').map(Number);
	if (!year || !month || !day || !todayYear || !todayMonth || !todayDay) return 0;
	return Math.round((Date.UTC(year, month - 1, day) - Date.UTC(todayYear, todayMonth - 1, todayDay)) / DAY_MS);
};

export const isOpen = (status: TaskStatus): boolean => status === 'todo' || status === 'in_progress';
