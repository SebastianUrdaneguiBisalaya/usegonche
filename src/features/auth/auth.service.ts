import type { PrismaClient, Profile } from '@usegonche/database';
import { AppError } from '../../lib/errors.js';
import type { GoogleLoginInput } from './auth.schemas.js';

export type AuthUser = { email?: string; id: string; user_metadata?: Record<string, unknown> };

/** Name chosen at sign up (`display_name`) or provided by Google (`full_name` / `name`); `null` when there is none. */
export const displayNameOf = (user: AuthUser): string | null => {
	const meta = user.user_metadata ?? {};
	for (const key of ['display_name', 'full_name', 'name']) {
		const value = meta[key];
		if (typeof value === 'string' && value.trim() !== '') return value.trim().slice(0, 100);
	}
	return null;
};

/** Profile picture the provider sent (Google: `avatar_url` / `picture`); `null` when there is none or it is not an http(s) URL. */
export const avatarUrlOf = (user: AuthUser): string | null => {
	const meta = user.user_metadata ?? {};
	for (const key of ['avatar_url', 'picture']) {
		const value = meta[key];
		if (typeof value === 'string' && /^https?:\/\//.test(value.trim())) return value.trim();
	}
	return null;
};

export const publicUser = (user: AuthUser) => ({ email: user.email, id: user.id });

/**
 * Keeps the app profile in sync after every sign-in (also creates it on the first Google sign-in). The provider's picture only fills an
 * empty avatar (the sign-up trigger may have created the profile without one): an avatar the user uploaded is never replaced.
 */
export const syncProfile = async (prisma: PrismaClient, user: AuthUser): Promise<Profile> => {
	const avatarUrl = avatarUrlOf(user);
	const profile = await prisma.profile.upsert({
		create: { avatarUrl, displayName: displayNameOf(user), email: user.email, id: user.id },
		update: { email: user.email },
		where: { id: user.id },
	});
	if (!avatarUrl || profile.avatarUrl) return profile;
	return prisma.profile.update({ data: { avatarUrl }, where: { id: user.id } });
};

export type GoogleConfig = {
	GOOGLE_CLIENT_ID?: string;
	GOOGLE_CLIENT_SECRET?: string;
	GOOGLE_DESKTOP_CLIENT_ID?: string;
	GOOGLE_DESKTOP_CLIENT_SECRET?: string;
};

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

/**
 * Trades a Google authorization code for the user's `id_token`. The web popup (GIS code flow) uses the `postmessage`
 * redirect and the web client; the desktop app sends its loopback `redirect_uri` + PKCE verifier and uses the desktop client.
 */
export async function exchangeGoogleCode(input: GoogleLoginInput, config: GoogleConfig, fetchFn: typeof fetch = fetch): Promise<string> {
	const desktop = input.redirect_uri !== undefined;
	const clientId = desktop ? config.GOOGLE_DESKTOP_CLIENT_ID : config.GOOGLE_CLIENT_ID;
	const clientSecret = desktop ? config.GOOGLE_DESKTOP_CLIENT_SECRET : config.GOOGLE_CLIENT_SECRET;
	if (!clientId || !clientSecret) throw new AppError('oauth_failed', 500);

	const body = new URLSearchParams({
		client_id: clientId,
		client_secret: clientSecret,
		code: input.code,
		grant_type: 'authorization_code',
		redirect_uri: input.redirect_uri ?? 'postmessage',
	});
	if (input.code_verifier) body.set('code_verifier', input.code_verifier);

	const res = await fetchFn(GOOGLE_TOKEN_URL, { body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, method: 'POST' });
	if (!res.ok) throw new AppError('invalid_or_expired_code', 400);
	const { id_token } = (await res.json().catch(() => ({}))) as { id_token?: string };
	if (!id_token) throw new AppError('invalid_or_expired_code', 400);
	return id_token;
}
