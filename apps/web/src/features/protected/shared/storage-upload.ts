import { getApiErrorMessage } from '~/lib/api-error';

/** PUTs the file straight to Supabase Storage (files never go through the API), the way supabase-js does for a signed upload URL. */
export function putToStorage(url: string, file: File, onProgress: (percent: number) => void): Promise<void> {
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
