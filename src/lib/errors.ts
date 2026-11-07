import type { ContentfulStatusCode } from 'hono/utils/http-status';

/**
 * Every error code the API can return, with its default (English) message.
 * Clients branch on `code` and localize on their side; `message` is a fallback for logs and quick display.
 * Add new codes here first: `fail()` and `AppError` only accept keys of this map.
 */
export const ERROR_MESSAGES = {
	already_exists: 'A resource with this name already exists.',
	bad_request: 'The request could not be processed.',
	dependency_cycle: 'This dependency would create a cycle.',
	email_not_confirmed: 'Confirm your email before signing in.',
	forbidden: 'You do not have access to this resource.',
	internal_error: 'Something went wrong. Please try again later.',
	invalid_credentials: 'Incorrect email or password.',
	invalid_email: 'Enter a valid email address.',
	invalid_or_expired_code: 'The code is invalid or has expired.',
	invalid_password: 'The password must be 8-72 characters long.',
	invalid_state: 'The resource is not in a state that allows this action.',
	not_found: 'Resource not found.',
	oauth_failed: 'Could not start sign-in with Google.',
	provider_conflict: 'This email is already linked to another sign-in method.',
	rate_limited: 'Too many requests. Please try again later.',
	reset_failed: 'Could not reset the password.',
	service_unavailable: 'This action is not available right now.',
	signup_failed: 'Could not create the account.',
	unauthorized: 'You must sign in to continue.',
	validation_error: 'The request data is invalid.',
	weak_password: 'The password is too weak.',
} as const;

export type ErrorCode = keyof typeof ERROR_MESSAGES;

export const messageFor = (code: ErrorCode): string => ERROR_MESSAGES[code];

/** Field-level detail, e.g. a failed validation: `{ field: 'email', code: 'invalid_string' }`. */
export type ErrorDetail = { code: string; field: string };

/** Throw from services; `onError` turns it into the standard error envelope. */
export class AppError extends Error {
	readonly code: ErrorCode;
	readonly details?: ErrorDetail[];
	readonly status: ContentfulStatusCode;

	constructor(code: ErrorCode, status: ContentfulStatusCode, details?: ErrorDetail[]) {
		super(code);
		this.code = code;
		this.status = status;
		this.details = details;
	}
}
