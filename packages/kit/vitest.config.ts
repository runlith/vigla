import { defineConfig } from 'vitest/config';

const root = new URL('.', import.meta.url).pathname;

export default defineConfig({
	test: {
		projects: [
			{
				resolve: { conditions: ['browser'] },
				ssr: { resolve: { conditions: ['browser'] } },
				test: { name: 'client', root, environment: 'jsdom', include: ['src/client/**/*.test.ts'] }
			},
			{
				test: {
					name: 'node',
					root,
					environment: 'node',
					include: ['src/**/*.test.ts'],
					exclude: ['src/client/**']
				}
			}
		]
	}
});
