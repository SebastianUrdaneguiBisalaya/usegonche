import * as SecureStore from 'expo-secure-store';

/**
 * The refresh token is the only credential persisted, and only in the iOS Keychain / Android Keystore (never AsyncStorage, never logged).
 * `THIS_DEVICE_ONLY`: it is not restored from a backup onto another device.
 */
const REFRESH_TOKEN_KEY = 'usegonche.refreshToken';
const options: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

export const readRefreshToken = (): Promise<string | null> => SecureStore.getItemAsync(REFRESH_TOKEN_KEY, options);
export const writeRefreshToken = (token: string): Promise<void> => SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token, options);
export const deleteRefreshToken = (): Promise<void> => SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY, options);
