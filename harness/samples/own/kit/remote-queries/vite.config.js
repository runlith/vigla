import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	build: { minify: false },
	cacheDir: '.vite-cache',
	clearScreen: false,
	plugins: [
		sveltekit({
			compilerOptions: { experimental: { async: true } },
			experimental: { remoteFunctions: true, forkPreloads: true }
		})
	]
});
