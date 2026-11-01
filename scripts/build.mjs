// Bundles the Node entry (src/index.ts) into a single self-contained dist/index.js for Docker / droplet deployments.
// Everything (including the @usegonche/* TypeScript workspace packages) is bundled, so the runtime image needs no node_modules.
import { build } from 'esbuild';

await build({
	banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
	bundle: true,
	entryPoints: ['src/index.ts'],
	// Optional native driver of `pg`; not used.
	external: ['pg-native'],
	format: 'esm',
	outfile: 'dist/index.js',
	platform: 'node',
	target: 'node22',
});
