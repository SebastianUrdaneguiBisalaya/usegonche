import 'i18next';
import type es from '@/i18n/locales/es.json';
import type mobileEs from '@/i18n/locales/mobile.es.json';

declare module 'i18next' {
	interface CustomTypeOptions {
		defaultNS: 'translation';
		resources: {
			translation: typeof es & typeof mobileEs;
		};
	}
}
