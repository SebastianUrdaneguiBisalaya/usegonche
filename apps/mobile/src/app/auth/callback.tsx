import { Redirect } from 'expo-router';

/**
 * `usegonche://auth/callback` is the Google sign-in redirect. `openAuthSessionAsync` reads it (see `features/auth/google.ts`), but on
 * Android the deep link also reaches the router: this route only sends it on to the screen the session allows.
 */
export default function AuthCallback() {
	return <Redirect href='/' />;
}
