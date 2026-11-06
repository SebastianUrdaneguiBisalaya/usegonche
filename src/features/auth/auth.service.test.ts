import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../../lib/errors.js';
import { createMockPrisma } from '../../test/helpers.js';
import { avatarUrlOf, displayNameOf, exchangeGoogleCode, syncProfile } from './auth.service.js';

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

describe('avatarUrlOf', () => {
	it('prefers avatar_url, then picture', () => {
		expect(avatarUrlOf({ id: 'u', user_metadata: { avatar_url: 'https://a.co/1.png', picture: 'https://a.co/2.png' } })).toBe('https://a.co/1.png');
		expect(avatarUrlOf({ id: 'u', user_metadata: { picture: ' https://a.co/2.png ' } })).toBe('https://a.co/2.png');
	});

	it('is null without an http(s) URL', () => {
		expect(avatarUrlOf({ id: 'u' })).toBeNull();
		expect(avatarUrlOf({ id: 'u', user_metadata: { avatar_url: 'javascript:alert(1)', picture: 3 } })).toBeNull();
	});
});

describe('syncProfile', () => {
	it('creates the profile with the display name and only refreshes the email afterwards', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.profile.upsert).mockResolvedValue({} as never);
		await syncProfile(prisma, { email: 'a@b.co', id: 'u1', user_metadata: { display_name: 'Ana Paz' } });
		expect(prisma.profile.upsert).toHaveBeenCalledWith({
			create: { avatarUrl: null, displayName: 'Ana Paz', email: 'a@b.co', id: 'u1' },
			update: { email: 'a@b.co' },
			where: { id: 'u1' },
		});
		expect(prisma.profile.update).not.toHaveBeenCalled();
	});

	it('fills an empty avatar with the Google picture', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.profile.upsert).mockResolvedValue({ avatarUrl: null } as never);
		vi.mocked(prisma.profile.update).mockResolvedValue({ avatarUrl: 'https://g.co/p.png' } as never);
		const user = { email: 'a@b.co', id: 'u1', user_metadata: { picture: 'https://g.co/p.png' } };
		expect(await syncProfile(prisma, user)).toEqual({ avatarUrl: 'https://g.co/p.png' });
		expect(prisma.profile.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ avatarUrl: 'https://g.co/p.png' }) }));
		expect(prisma.profile.update).toHaveBeenCalledWith({ data: { avatarUrl: 'https://g.co/p.png' }, where: { id: 'u1' } });
	});

	it('replaces an outdated avatar with the current Google picture', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.profile.upsert).mockResolvedValue({ avatarUrl: 'https://g.co/old.png' } as never);
		await syncProfile(prisma, { id: 'u1', user_metadata: { picture: 'https://g.co/p.png' } });
		expect(prisma.profile.update).toHaveBeenCalledWith({ data: { avatarUrl: 'https://g.co/p.png' }, where: { id: 'u1' } });
	});

	it('writes nothing when the avatar already matches, or without a provider picture', async () => {
		const prisma = createMockPrisma();
		vi.mocked(prisma.profile.upsert).mockResolvedValue({ avatarUrl: 'https://g.co/p.png' } as never);
		await syncProfile(prisma, { id: 'u1', user_metadata: { picture: 'https://g.co/p.png' } });
		vi.mocked(prisma.profile.upsert).mockResolvedValue({ avatarUrl: 'https://cdn/mine.png' } as never);
		await syncProfile(prisma, { id: 'u1', user_metadata: {} });
		expect(prisma.profile.update).not.toHaveBeenCalled();
	});
});
