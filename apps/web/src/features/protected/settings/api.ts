import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sessionKey } from '~/features/auth/api';
import { api, type Body } from '~/lib/api';
import { type Data, getApiErrorMessage, unwrap } from '~/lib/api-error';
import { putToStorage } from '../shared/storage-upload';

/** Request bodies and rows come from the API through the RPC client: nothing is redeclared here. */
export type UserSettings = Data<Awaited<ReturnType<typeof api.profile.settings.$get>>>;
export type UpdateSettingsBody = Body<typeof api.profile.settings.$patch>;
export type UpdateProfileBody = Body<typeof api.profile.$patch>;
type AvatarUploadBody = Body<(typeof api.profile.avatar)['upload-url']['$post']>;

export const settingsKey = ['profile', 'settings'] as const;

export function useUserSettings() {
	// Silent: it also runs in the layout to sync preferences, where a failure must not toast (the local preference keeps working).
	return useQuery({ meta: { silent: true }, queryFn: () => unwrap(api.profile.settings.$get()), queryKey: settingsKey, retry: false });
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

/** Asks the API for a signed upload URL, uploads the avatar to Storage and resolves with its permanent public URL (not saved on the profile yet). */
export async function uploadAvatar(file: File, onProgress: (percent: number) => void): Promise<string> {
	const upload = await unwrap(api.profile.avatar['upload-url'].$post({ json: { mimeType: file.type as AvatarUploadBody['mimeType'], sizeBytes: file.size } }));
	await putToStorage(upload.uploadUrl, file, onProgress);
	return upload.publicUrl;
}
