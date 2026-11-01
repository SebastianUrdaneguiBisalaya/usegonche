import type { Context } from 'hono';
import { fail } from './http.js';

type HookResult = { error?: { issues: { code: string; path: PropertyKey[] }[] }; success: boolean };

/**
 * Default `zValidator` hook: answers with the standard error envelope (422 `validation_error` + per-field `details`).
 * Usage: `zValidator('json', schema, validationHook)`. Routes with a special failure answer pass their own hook instead
 * (e.g. login must not reveal which field failed).
 */
export const validationHook = (result: HookResult, c: Context) => {
	if (result.success) return;
	return fail(
		c,
		'validation_error',
		422,
		result.error?.issues.map(issue => ({ code: issue.code, field: issue.path.join('.') }))
	);
};
