import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useTranslate } from '~/hooks/use-translate';
import { API_URL } from '~/lib/api';
import { type GoogleLoginInput, useLoginWithGoogle } from './api';

/** Google OAuth client id of the web popup; must match the API's `GOOGLE_CLIENT_ID`. Without it the browser falls back to the API's redirect flow. */
const googleClientId: string | undefined = import.meta.env.VITE_GOOGLE_CLIENT_ID;
/** "Desktop app" OAuth client id used inside the desktop app; must match the API's `GOOGLE_DESKTOP_CLIENT_ID`. Without it the Google buttons are hidden there. */
const googleDesktopClientId: string | undefined = import.meta.env.VITE_GOOGLE_DESKTOP_CLIENT_ID;

let scriptPromise: Promise<void> | undefined;

function loadGoogleScript() {
	scriptPromise ??= new Promise<void>((resolve, reject) => {
		const script = document.createElement('script');
		script.src = 'https://accounts.google.com/gsi/client';
		script.async = true;
		script.onload = () => resolve();
		script.onerror = () => {
			scriptPromise = undefined;
			reject(new Error('Google script failed to load'));
		};
		document.head.append(script);
	});
	return scriptPromise;
}

/**
 * Google sign-in with the popup authorization-code flow: Google hands the page a
 * one-time `code`, and the API (which holds the client secret) exchanges it
 * for the user's identity and opens the session (`POST /auth/google`). Request errors are toasted by the query client.
 *
 * Inside the desktop app Google refuses that popup (embedded browser), so the desktop
 * bridge signs in through the system browser instead and hands back the code with the
 * loopback redirect URI and PKCE verifier it used, which the API needs to exchange it.
 * In a browser without `VITE_GOOGLE_CLIENT_ID` it navigates to the API's redirect flow (`GET /auth/google`).
 */
export function useGoogleSignIn() {
	const t = useTranslate();
	const navigate = useNavigate();
	const loginWithGoogle = useLoginWithGoogle();
	// Known only after hydration: the server render has no `window.desktop`.
	const [isDesktop, setIsDesktop] = useState(false);

	useEffect(() => {
		if (window.desktop) {
			setIsDesktop(true);
			return;
		}
		// Load ahead of the click so the popup opens while the click's user activation is still valid.
		if (googleClientId) void loadGoogleScript().catch(() => {});
	}, []);

	const login = (data: GoogleLoginInput) => {
		loginWithGoogle.mutate(data, {
			onSuccess: () => {
				void navigate('/', {
					replace: true,
				});
			},
		});
	};

	const signInOnDesktop = async (clientId: string) => {
		try {
			const grant = await window.desktop?.googleSignIn(clientId);
			// No grant means the user cancelled in the browser; nothing to report.
			if (!grant) return;
			login({
				code: grant.code,
				code_verifier: grant.codeVerifier,
				redirect_uri: grant.redirectUri,
			});
		} catch {
			toast.error(t('errors.generic'));
		}
	};

	const signIn = async () => {
		if (isDesktop) {
			if (googleDesktopClientId) await signInOnDesktop(googleDesktopClientId);
			return;
		}
		if (!googleClientId) {
			window.location.assign(`${API_URL}/auth/google`);
			return;
		}
		try {
			await loadGoogleScript();
		} catch {
			toast.error(t('errors.generic'));
			return;
		}
		window.google?.accounts.oauth2
			.initCodeClient({
				callback: ({ code }) => {
					// No code means the user closed the popup or denied access; nothing to report.
					if (!code) return;
					login({
						code,
					});
				},
				client_id: googleClientId,
				scope: 'openid email profile',
				ux_mode: 'popup',
			})
			.requestCode();
	};

	return {
		enabled: isDesktop ? Boolean(googleDesktopClientId) : true,
		isPending: loginWithGoogle.isPending,
		signIn,
	};
}
