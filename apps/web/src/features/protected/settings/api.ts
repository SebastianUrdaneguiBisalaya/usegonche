import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sessionKey } from '~/features/auth/api';
import { api, type Body } from '~/lib/api';
import { type Data, getApiErrorMessage, unwrap } from '~/lib/api-error';

/** Request bodies and rows come from the API through the RPC client: nothing is redeclared here. */
export type UserSettings = Data<Awaited<ReturnType<typeof api.profile.settings.$get>>>;
export type UpdateSettingsBody = Body<typeof api.profile.settings.$patch>;
export type UpdateProfileBody = Body<typeof api.profile.$patch>;
type AvatarUploadBody = Body<(typeof api.profile.avatar)['upload-url']['$post']>;

export const settingsKey = ['profile', 'settings'] as const;

export function useUserSettings() {
	return useQuery({ queryFn: () => unwrap(api.profile.settings.$get()), queryKey: settingsKey });
}

/** Country and time zone are saved together (`PATCH /profile/settings`); the answer replaces the cached settings. */
export function useUpdateSettings() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (json: UpdateSettingsBody) => unwrap(api.profile.settings.$patch({ json })),
		onSuccess: settings => queryClient.setQueryData(settingsKey, settings),
	});
}

/** Edits the profile (`PATCH /profile`). The session carries the profile (sidebar avatar and name), so it is refetched once saved. */
export function useUpdateProfile() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (json: UpdateProfileBody) => unwrap(api.profile.$patch({ json })),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: sessionKey }),
	});
}

/** PUTs the file straight to Supabase Storage (files never go through the API), the way supabase-js does for a signed upload URL. */
function putToStorage(url: string, file: File, onProgress: (percent: number) => void): Promise<void> {
	return new Promise((resolve, reject) => {
		const fail = () => reject(new Error(getApiErrorMessage(null)));
		const body = new FormData();
		body.append('cacheControl', '3600');
		body.append('', file);

		const request = new XMLHttpRequest();
		request.open('PUT', url);
		request.upload.onprogress = event => event.lengthComputable && onProgress(Math.round((event.loaded / event.total) * 100));
		request.onload = () => (request.status >= 200 && request.status < 300 ? resolve() : fail());
		request.onerror = fail;
		request.send(body);
	});
}

/** Asks the API for a signed upload URL, uploads the avatar to Storage and resolves with its permanent public URL (not saved on the profile yet). */
export async function uploadAvatar(file: File, onProgress: (percent: number) => void): Promise<string> {
	const upload = await unwrap(api.profile.avatar['upload-url'].$post({ json: { mimeType: file.type as AvatarUploadBody['mimeType'], sizeBytes: file.size } }));
	await putToStorage(upload.uploadUrl, file, onProgress);
	return upload.publicUrl;
}
