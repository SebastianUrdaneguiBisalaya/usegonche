import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Privileged client (bypasses RLS). Server only: never ship the secret key to a browser or mobile app. */
export const createSupabaseAdmin = (url: string, secretKey: string): SupabaseClient => createClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false } });
