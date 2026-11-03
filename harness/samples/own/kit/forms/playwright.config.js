import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: 'test',
	projects: [{ name: 'chromium-dev', use: { browserName: 'chromium' } }],
	retries: Number(process.env.KIT_E2E_RETRIES ?? 0),
	use: { baseURL: 'http://localhost:5330' },
	webServer: {
		command: 'pnpm dev --port 5330 --strictPort',
		port: 5330
	}
});
