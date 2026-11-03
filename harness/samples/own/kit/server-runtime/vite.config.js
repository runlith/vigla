import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	clearScreen: false,
	plugins: [
		sveltekit({
			adapter: adapter(),
			csp: { directives: { 'script-src': ['self'] } },
			compilerOptions: { experimental: { async: true } }
		})
	]
});
