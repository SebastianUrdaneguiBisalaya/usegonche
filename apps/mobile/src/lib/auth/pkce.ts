import { CryptoDigestAlgorithm, CryptoEncoding, digestStringAsync, getRandomBytes } from 'expo-crypto';

const base64url = (base64: string): string => base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const bytesToBase64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));

/**
 * PKCE pair (RFC 7636, S256). The verifier is generated on the device and never leaves it until the code exchange;
 * only the challenge goes into the authorize URL.
 */
export async function createPkcePair(): Promise<{ challenge: string; verifier: string }> {
	// 32 random bytes -> 43 base64url chars, the minimum verifier length the API accepts.
	const verifier = base64url(bytesToBase64(getRandomBytes(32)));
	const challenge = base64url(await digestStringAsync(CryptoDigestAlgorithm.SHA256, verifier, { encoding: CryptoEncoding.BASE64 }));
	return { challenge, verifier };
}
