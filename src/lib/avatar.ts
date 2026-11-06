import { getSupabase } from '@usegonche/auth/hono';
import { providersOf } from '@usegonche/auth/policy';
import type { Context } from 'hono';

type User = Parameters<typeof providersOf>[0];

/**
 * Accounts that sign in with Google show the Google picture: it is synced on every sign-in and cannot be changed or removed in the app.
 * Shared by `/me` (tells the client) and `/profile` (enforces it).
 */
export const isProviderAvatar = (user: User | null | undefined): boolean => !!user && providersOf(user).has('google');

/** `isProviderAvatar` for the request's user (asks Supabase Auth for the linked identities). */
export const hasProviderAvatar = async (c: Context): Promise<boolean> => isProviderAvatar((await getSupabase(c).auth.getUser()).data.user);
