import type { ErrorHandler, NotFoundHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { AppEnv } from '../env.js';
import { AppError } from '../lib/errors.js';
import { fail } from '../lib/http.js';

/** Maps every thrown error to the standard error envelope. Unexpected errors never leak their message. */
export const onError: ErrorHandler<AppEnv> = (err, c) => {
	if (err instanceof AppError) return fail(c, err.code, err.status as 400, err.details);
	if (err instanceof HTTPException) {
		const status = err.status as ContentfulStatusCode;
		if (status === 403 && err.message === 'email_not_confirmed') return fail(c, 'email_not_confirmed', 403);
		const code = status === 401 ? 'unauthorized' : status === 403 ? 'forbidden' : status === 404 ? 'not_found' : status < 500 ? 'bad_request' : 'internal_error';
		return fail(c, code, status as 400);
	}
	console.error(err);
	return fail(c, 'internal_error', 500);
};

export const onNotFound: NotFoundHandler<AppEnv> = c => fail(c, 'not_found', 404);
