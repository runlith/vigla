import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: 'test',
	timeout: 90000,
	expect: { timeout: 15000 },
	projects: [{ name: 'chromium-dev', use: { browserName: 'chromium' } }],
	retries: Number(process.env.KIT_E2E_RETRIES ?? 0),
	use: { baseURL: 'http://localhost:6121' },
	webServer: {
		command: 'pnpm dev --port 6121 --strictPort',
		port: 6121,
		timeout: 120000
	}
});
