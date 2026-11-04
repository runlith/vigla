import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = fileURLToPath(new URL('.', import.meta.url));
const kit = (file: string) =>
	fileURLToPath(new URL(`../kit/src/entries/app/${file}/client.ts`, import.meta.url));

export default defineConfig({
	test: {
		projects: [
			{
				resolve: {
					conditions: ['browser'],
					alias: { '$app/forms': kit('forms'), '$app/state': kit('state') }
				},
				ssr: { resolve: { conditions: ['browser'] } },
				test: { name: 'client', root, environment: 'jsdom', include: ['src/**/*.client.test.ts'] }
			},
			{
				test: {
					name: 'node',
					root,
					environment: 'node',
					include: ['src/**/*.test.ts'],
					exclude: ['src/**/*.client.test.ts']
				}
			}
		]
	}
});
