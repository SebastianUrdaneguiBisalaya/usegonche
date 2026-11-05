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

const updateSettingsKey = [...settingsKey, 'update'] as const;

/**
 * Country and time zone are saved together (`PATCH /profile/settings`); the answer replaces the cached settings.
 * Saves can pile up (the theme toggled quickly): they share a scope, so they reach the API one after the other in order, and only the last
 * one writes the cache. An earlier answer would bring back a value already replaced (dark -> light -> dark flashing light again).
 */
export function useUpdateSettings() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (json: UpdateSettingsBody) => unwrap(api.profile.settings.$patch({ json })),
		mutationKey: updateSettingsKey,
		onSettled: (settings, error) => {
			// This save still counts as in flight here: 1 means no newer one is waiting.
			if (queryClient.isMutating({ mutationKey: updateSettingsKey }) > 1) return;
			if (settings) queryClient.setQueryData(settingsKey, settings);
			else if (error) void queryClient.invalidateQueries({ queryKey: settingsKey });
		},
		scope: { id: 'profile-settings' },
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

export type Availability = Data<Awaited<ReturnType<typeof api.planning.availability.$get>>>;
export type AvailabilityWindow = Body<typeof api.planning.availability.$put>['windows'][number];

export const availabilityKey = ['planning', 'availability'] as const;

/** The weekly working-hours template (`GET /planning/availability`). */
export function useAvailability() {
	return useQuery({ queryFn: () => unwrap(api.planning.availability.$get()), queryKey: availabilityKey });
}

/** Replaces the whole template (`PUT /planning/availability`). Today's capacity depends on it, so every plan refetches. */
export function useSetAvailability() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (windows: AvailabilityWindow[]) => unwrap(api.planning.availability.$put({ json: { windows } })),
		onSuccess: async availability => {
			queryClient.setQueryData(availabilityKey, availability);
			await queryClient.invalidateQueries({ queryKey: ['planning', 'day'] });
		},
	});
}
