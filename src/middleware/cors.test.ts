import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AppEnv } from '../env.js';
import { allowedOrigins, corsMiddleware } from './cors.js';

const app = new Hono<AppEnv>().use(corsMiddleware()).get('/ping', c => c.json({ ok: true }));
const bindings = { AUTH_REDIRECT_URL: 'http://localhost:5173/some/path', CORS_ORIGINS: 'https://staging.example.com, https://app.example.com' };
const request = (origin: string, init: RequestInit = {}) => app.request('/ping', { ...init, headers: { origin, ...init.headers } });

describe('allowedOrigins', () => {
	it('uses the origin of AUTH_REDIRECT_URL plus CORS_ORIGINS', () => {
		expect(allowedOrigins(bindings)).toEqual(['http://localhost:5173', 'https://staging.example.com', 'https://app.example.com']);
	});

	it('ignores unset and invalid values', () => {
		expect(allowedOrigins({})).toEqual([]);
		expect(allowedOrigins({ AUTH_REDIRECT_URL: 'not a url', CORS_ORIGINS: ',' })).toEqual([]);
	});
});

describe('corsMiddleware', () => {
	// On Node `env(c)` reads `process.env` (on Workers it reads the bindings).
	beforeEach(() => Object.assign(process.env, bindings));
	afterEach(() => {
		delete process.env.AUTH_REDIRECT_URL;
		delete process.env.CORS_ORIGINS;
	});

	it('answers the preflight of an allowed origin with credentials', async () => {
		const res = await request('http://localhost:5173', { headers: { 'access-control-request-method': 'POST' }, method: 'OPTIONS' });
		expect(res.status).toBe(204);
		expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
		expect(res.headers.get('access-control-allow-credentials')).toBe('true');
	});

	it('adds the headers to a normal response of an allowed origin', async () => {
		const res = await request('https://staging.example.com');
		expect(res.status).toBe(200);
		expect(res.headers.get('access-control-allow-origin')).toBe('https://staging.example.com');
	});

	it('sends no CORS headers to an unknown origin', async () => {
		const res = await request('https://evil.example.com');
		expect(res.headers.get('access-control-allow-origin')).toBeNull();
	});
});
