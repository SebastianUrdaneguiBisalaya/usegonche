import { useQuery } from '@tanstack/react-query';
import { api } from '~/lib/api';
import { type Data, unwrap } from '~/lib/api-error';

export type GettingStartedProgress = Data<Awaited<ReturnType<(typeof api.profile)['getting-started']['$get']>>>;
export type GettingStartedStep = keyof GettingStartedProgress;

/** The checklist order: each step builds on the one before (a goal is tagged, a project serves a goal, a task lives in a project, the plan picks tasks). */
export const gettingStartedSteps: readonly GettingStartedStep[] = ['tag', 'goal', 'project', 'task', 'plan'];

export const gettingStartedKey = ['profile', 'getting-started'] as const;

/** Which steps the user has already done, read from their own data (`GET /profile/getting-started`). */
export function useGettingStarted(enabled: boolean) {
	return useQuery({ enabled, queryFn: () => unwrap(api.profile['getting-started'].$get()), queryKey: gettingStartedKey });
}
