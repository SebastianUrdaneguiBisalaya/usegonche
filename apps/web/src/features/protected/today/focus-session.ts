import { create } from 'zustand';

/** Sessions shorter than this are not recorded: a block needs a real stretch of time, and a stray click should leave no trace. */
export const MIN_RECORDED_MS = 60_000;
export const DEFAULT_FOCUS_MINUTES = 25;
export const FOCUS_PRESETS = [15, 25, 45, 60] as const;

type Phase = 'idle' | 'paused' | 'running';

interface FocusSessionState {
	pause: () => void;
	phase: Phase;
	/** Planned length of the session. */
	plannedMinutes: number;
	reset: () => void;
	resume: () => void;
	/** When the running stretch began (epoch ms); `null` unless running. */
	segmentStart: number | null;
	setPlannedMinutes: (minutes: number) => void;
	setTaskId: (taskId: string | null) => void;
	start: () => void;
	/** When the session first started (epoch ms): the start of the block it will record. */
	startedAt: number | null;
	taskId: string | null;
	/** Time already worked before the running stretch (pauses are not counted). */
	workedBeforeMs: number;
}

/**
 * The focus session lives in memory, outside any component: it survives going to another page and coming back (a timer that vanished when you
 * open Tasks would be useless). It is plain frontend state; only a finished or stopped session reaches the API, as a time block.
 */
export const useFocusSession = create<FocusSessionState>()(set => ({
	pause: () => set(state => (state.phase === 'running' ? { phase: 'paused', segmentStart: null, workedBeforeMs: state.workedBeforeMs + (Date.now() - (state.segmentStart ?? Date.now())) } : state)),
	phase: 'idle',
	plannedMinutes: DEFAULT_FOCUS_MINUTES,
	reset: () => set({ phase: 'idle', segmentStart: null, startedAt: null, workedBeforeMs: 0 }),
	resume: () => set(state => (state.phase === 'paused' ? { phase: 'running', segmentStart: Date.now() } : state)),
	segmentStart: null,
	setPlannedMinutes: plannedMinutes => set(state => (state.phase === 'idle' ? { plannedMinutes } : state)),
	setTaskId: taskId => set(state => (state.phase === 'idle' ? { taskId } : state)),
	start: () => set(state => (state.phase === 'idle' ? { phase: 'running', segmentStart: Date.now(), startedAt: Date.now(), workedBeforeMs: 0 } : state)),
	startedAt: null,
	taskId: null,
	workedBeforeMs: 0,
}));

type Snapshot = Pick<FocusSessionState, 'plannedMinutes' | 'segmentStart' | 'workedBeforeMs'>;

/** Time really worked at `now`: what was banked before plus the running stretch. */
export const workedMs = (state: Snapshot, now: number): number => state.workedBeforeMs + (state.segmentStart === null ? 0 : now - state.segmentStart);

/** Time left of the planned length at `now`, never below zero. */
export const remainingMs = (state: Snapshot, now: number): number => Math.max(state.plannedMinutes * 60_000 - workedMs(state, now), 0);
