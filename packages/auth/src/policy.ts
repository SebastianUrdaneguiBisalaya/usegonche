import type { User } from '@supabase/supabase-js';
import type { SupabaseClient } from './hono.js';

/** Sign-in methods linked to a user: 'email' (password), 'google', ... */
export const providersOf = (user: User): Set<string> => new Set((user.identities ?? []).map(identity => identity.provider));

/**
 * One account = one sign-in method. Supabase merges identities that share an email and cannot be told not to,
 * so the policy is enforced here (and in the database, see sql/block_cross_provider_identity.sql).
 * Returns true, after dropping the session, when the user has more than one provider.
 */
export async function rejectMixedProviders(supabase: SupabaseClient, user: User): Promise<boolean> {
	if (providersOf(user).size <= 1) return false;
	await supabase.auth.signOut({ scope: 'local' });
	return true;
}
