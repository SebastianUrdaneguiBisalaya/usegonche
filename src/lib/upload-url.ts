import type { Storage, UploadUrl, Visibility } from '@usegonche/storage';

type UploadName = { extension?: never; filename: string } | { extension: string; filename?: never };

/**
 * Where a file goes and how it is named. The path is always `<ownerId>/<folder>/<name>`:
 * - `folder` defaults to a fresh UUID (one folder per upload); pass a fixed one to group files (e.g. `avatar`).
 * - `filename` is used as is; `extension` instead gives the file a fresh UUID name (`<uuid>.<extension>`), so a new file never serves a stale cached one.
 */
export type OwnerUploadOptions = UploadName & { folder?: string; visibility: Visibility };

/**
 * Signed URL for the client to upload a file straight to Storage, under the owner's folder (the one place that builds owner-scoped storage paths).
 * Nothing is stored anywhere else: callers decide what to record once the upload succeeds.
 */
export const createOwnerUploadUrl = (storage: Storage, ownerId: string, { extension, filename, folder, visibility }: OwnerUploadOptions): Promise<UploadUrl> =>
	storage.uploadUrl(visibility, `${ownerId}/${folder ?? crypto.randomUUID()}/${filename ?? `${crypto.randomUUID()}.${extension}`}`);
