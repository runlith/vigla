import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: 'test',
	timeout: 60000,
	projects: [{ name: 'chromium-dev', use: { browserName: 'chromium' } }],
	retries: Number(process.env.KIT_E2E_RETRIES ?? 0),
	use: { baseURL: 'http://localhost:6102' },
	webServer: {
		command: 'pnpm dev --port 6102 --strictPort',
		port: 6102
	}
});
