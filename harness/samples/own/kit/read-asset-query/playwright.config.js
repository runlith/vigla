import process from 'node:process';
import { defineConfig } from '@playwright/test';

const port = Number(process.env.KIT_E2E_PORT ?? 6470);

export default defineConfig({
	testDir: 'test',
	projects: [{ name: 'chromium-dev', use: { browserName: 'chromium' } }],
	retries: Number(process.env.KIT_E2E_RETRIES ?? 0),
	workers: 1,
	use: { baseURL: `http://localhost:${port}` },
	webServer: {
		command: process.env.DEV
			? `vite dev --port ${port} --strictPort`
			: `vite build && vite preview --port ${port} --strictPort`,
		port,
		reuseExistingServer: false,
		timeout: 180_000
	}
});
