/** Base URL of the web app (`apps/web`), where the landing's sign-in and sign-up links point. */
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:5173';

export const SIGN_IN_URL = `${APP_URL}/auth/sign-in`;
export const SIGN_UP_URL = `${APP_URL}/auth/sign-up`;
