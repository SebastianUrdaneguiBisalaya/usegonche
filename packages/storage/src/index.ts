import type { SupabaseClient } from '@supabase/supabase-js';

export type Visibility = 'private' | 'public';

/** Bucket names per visibility. Create the public one as a public bucket and the private one as private. */
export type StorageBuckets = Record<Visibility, string>;

export type UploadUrl = {
	path: string;
	/** Token for `supabase.storage.from(bucket).uploadToSignedUrl(path, token, file)` on the client. */
	token: string;
	/** URL the client uploads the file to directly (PUT). */
	uploadUrl: string;
	visibility: Visibility;
};

/**
 * Issues signed URLs only: files never pass through the API.
 * The client uploads to / downloads from Supabase Storage directly using the URLs returned here.
 * Pass the request-scoped client (RLS applies) or an admin client (bypasses RLS).
 */
export function createStorage(supabase: SupabaseClient, buckets: StorageBuckets) {
	const bucket = (visibility: Visibility) => supabase.storage.from(buckets[visibility]);

	return {
		async list(visibility: Visibility, folder = '') {
			const { data, error } = await bucket(visibility).list(folder);
			if (error) throw error;
			return data;
		},
		/**
		 * URL to read a file. Public: permanent public URL (no request needed to Supabase).
		 * Private: signed URL that expires after `expiresInSeconds`.
		 */
		async readUrl(visibility: Visibility, path: string, expiresInSeconds = 3600): Promise<string> {
			if (visibility === 'public') return bucket('public').getPublicUrl(path).data.publicUrl;
			const { data, error } = await bucket('private').createSignedUrl(path, expiresInSeconds);
			if (error) throw error;
			return data.signedUrl;
		},
		async remove(visibility: Visibility, paths: string[]) {
			const { error } = await bucket(visibility).remove(paths);
			if (error) throw error;
		},
		/** Signed URL (valid 2 hours) for the client to upload a file directly to the public or private bucket. */
		async uploadUrl(visibility: Visibility, path: string, options?: { upsert: boolean }): Promise<UploadUrl> {
			const { data, error } = await bucket(visibility).createSignedUploadUrl(path, options);
			if (error) throw error;
			return { path: data.path, token: data.token, uploadUrl: data.signedUrl, visibility };
		},
	};
}

export type Storage = ReturnType<typeof createStorage>;
