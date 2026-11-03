import { describe, expect, it, vi } from 'vitest';
import { createMockStorage, OTHER_USER_ID, TEST_USER_ID } from '../test/helpers.js';
import { createOwnerUploadUrl } from './upload-url.js';

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const signed = { path: 'p', token: 't', uploadUrl: 'u', visibility: 'private' } as const;

const setup = () => {
	const storage = createMockStorage();
	vi.mocked(storage.uploadUrl).mockResolvedValue(signed);
	return storage;
};

describe('createOwnerUploadUrl', () => {
	it('puts a fixed filename in a fresh folder of the owner and returns the signed URL', async () => {
		const storage = setup();
		expect(await createOwnerUploadUrl(storage, TEST_USER_ID, { filename: 'file', visibility: 'private' })).toBe(signed);
		expect(storage.uploadUrl).toHaveBeenCalledWith('private', expect.stringMatching(new RegExp(`^${TEST_USER_ID}/${UUID}/file$`)));
	});

	it('gives a fresh UUID name with the extension inside a fixed folder', async () => {
		const storage = setup();
		await createOwnerUploadUrl(storage, TEST_USER_ID, { extension: 'png', folder: 'avatar', visibility: 'public' });
		expect(storage.uploadUrl).toHaveBeenCalledWith('public', expect.stringMatching(new RegExp(`^${TEST_USER_ID}/avatar/${UUID}\\.png$`)));
	});

	it('never repeats a path and always starts with the owner', async () => {
		const storage = setup();
		await createOwnerUploadUrl(storage, TEST_USER_ID, { filename: 'file', visibility: 'private' });
		await createOwnerUploadUrl(storage, TEST_USER_ID, { filename: 'file', visibility: 'private' });
		await createOwnerUploadUrl(storage, OTHER_USER_ID, { filename: 'file', visibility: 'private' });
		const paths = vi.mocked(storage.uploadUrl).mock.calls.map(call => call[1]);
		expect(new Set(paths).size).toBe(3);
		expect(paths[2]?.startsWith(`${OTHER_USER_ID}/`)).toBe(true);
	});
});
