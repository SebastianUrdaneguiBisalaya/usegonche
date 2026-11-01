import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		environment: 'node',
		// Rate limiting is covered by its own tests; everything else runs without it.
		env: { RATE_LIMIT_DISABLED: 'true' },
		include: ['src/**/*.test.ts'],
		exclude: ['node_modules', 'dist'],
		coverage: {
			provider: 'v8',
			include: ['src/**/*.ts'],
			exclude: ['src/**/*.test.ts', 'src/index.ts', 'src/worker.ts'],
		},
	},
});
