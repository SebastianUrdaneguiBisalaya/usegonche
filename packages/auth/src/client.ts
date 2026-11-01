import { createBrowserClient } from '@supabase/ssr';

/** Browser client for the web app (cookie-based session shared with the server). */
export const createBrowserSupabase = (url: string, publishableKey: string) => createBrowserClient(url, publishableKey);
