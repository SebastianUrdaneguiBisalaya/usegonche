/** The slice of Google Identity Services (`accounts.google.com/gsi/client`) the code flow uses. */
interface Window {
	google?: {
		accounts: {
			oauth2: {
				initCodeClient: (config: { callback: (response: { code?: string }) => void; client_id: string; scope: string; ux_mode: 'popup' }) => { requestCode: () => void };
			};
		};
	};
}
