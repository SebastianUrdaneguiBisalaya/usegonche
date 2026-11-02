import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../../lib/errors.js';
import { createMockPrisma } from '../../test/helpers.js';
import { displayNameOf, exchangeGoogleCode, syncProfile } from './auth.service.js';

const config = { GOOGLE_CLIENT_ID: 'web-id', GOOGLE_CLIENT_SECRET: 'web-secret', GOOGLE_DESKTOP_CLIENT_ID: 'desk-id', GOOGLE_DESKTOP_CLIENT_SECRET: 'desk-secret' };
const answer = (body: unknown, ok = true) => vi.fn(async () => ({ json: async () => body, ok }) as Response);
const sentBody = (fetchFn: ReturnType<typeof answer>) => (fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1].body as URLSearchParams;

describe('exchangeGoogleCode', () => {
	it('uses the web client and the postmessage redirect for the popup flow', async () => {
		const fetchFn = answer({ id_token: 'tok' });
		await expect(exchangeGoogleCode({ code: 'c' }, config, fetchFn)).resolves.toBe('tok');
		const body = sentBody(fetchFn);
		expect(body.get('client_id')).toBe('web-id');
		expect(body.get('client_secret')).toBe('web-secret');
		expect(body.get('redirect_uri')).toBe('postmessage');
		expect(body.has('code_verifier')).toBe(false);
	});

	it('uses the desktop client, loopback redirect and PKCE verifier for the desktop flow', async () => {
		const fetchFn = answer({ id_token: 'tok' });
		await exchangeGoogleCode({ code: 'c', code_verifier: 'v', redirect_uri: 'http://127.0.0.1:5000' }, config, fetchFn);
		const body = sentBody(fetchFn);
		expect(body.get('client_id')).toBe('desk-id');
		expect(body.get('client_secret')).toBe('desk-secret');
		expect(body.get('redirect_uri')).toBe('http://127.0.0.1:5000');
		expect(body.get('code_verifier')).toBe('v');
	});

	it('fails with oauth_failed when the client is not configured', async () => {
		const fetchFn = answer({});
		await expect(exchangeGoogleCode({ code: 'c' }, {}, fetchFn)).rejects.toMatchObject({ code: 'oauth_failed', status: 500 });
		expect(fetchFn).not.toHaveBeenCalled();
	});

	it.each([
		['Google rejects the code', answer({}, false)],
		['Google answers without id_token', answer({})],
	])('fails with invalid_or_expired_code when %s', async (_name, fetchFn) => {
		const error = await exchangeGoogleCode({ code: 'c' }, config, fetchFn).catch(e => e);
		expect(error).toBeInstanceOf(AppError);
		expect(error).toMatchObject({ code: 'invalid_or_expired_code', status: 400 });
	});
});

describe('displayNameOf', () => {
	it('prefers display_name, then full_name, then name', () => {
		expect(displayNameOf({ id: 'u', user_metadata: { display_name: ' Ana Paz ', full_name: 'X', name: 'Y' } })).toBe('Ana Paz');
		expect(displayNameOf({ id: 'u', user_metadata: { full_name: 'Luis Gil', name: 'Y' } })).toBe('Luis Gil');
		expect(displayNameOf({ id: 'u', user_metadata: { name: 'Eva' } })).toBe('Eva');
	});

	it('is null without a usable name', () => {
		expect(displayNameOf({ id: 'u' })).toBeNull();
		expect(displayNameOf({ id: 'u', user_metadata: { display_name: '  ', name: 3 } })).toBeNull();
	});
});

describe('syncProfile', () => {
	it('creates the profile with the display name and only refreshes the email afterwards', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.profile.upsert).mockResolvedValue({} as never);
		await syncProfile(prisma, { email: 'a@b.co', id: 'u1', user_metadata: { display_name: 'Ana Paz' } });
		expect(prisma.profile.upsert).toHaveBeenCalledWith({
			create: { displayName: 'Ana Paz', email: 'a@b.co', id: 'u1' },
			update: { email: 'a@b.co' },
			where: { id: 'u1' },
		});
	});
});
