import { devices } from '@playwright/test';
import process from 'node:process';
import { number_from_env } from '../../../test-utils/index.js';

const port = number_from_env('KIT_E2E_PORT', 5173);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
	throw new Error('KIT_E2E_PORT must be an integer between 1 and 65535');
}
const baseURL = `http://127.0.0.1:${port}`;

/** @type {import('@playwright/test').PlaywrightTestConfig} */
export const config = {
	forbidOnly: !!process.env.CI,
	// generous timeouts on CI
	timeout: process.env.CI ? 45000 : 15000,
	webServer: {
		command: `pnpm build && MY_CUSTOM_HOST=127.0.0.1 MY_CUSTOM_PORT=${port} INSTRUMENTATION_ENV=available node build`,
		url: baseURL,
		reuseExistingServer: false
	},
	retries: process.env.CI ? 2 : number_from_env('KIT_E2E_RETRIES', 0),
	projects: [
		{
			name: 'chromium'
		}
	],
	use: {
		...devices['Desktop Chrome'],
		baseURL,
		screenshot: 'only-on-failure',
		trace: 'retain-on-failure',
	},
	workers: process.env.CI ? 2 : number_from_env('KIT_E2E_WORKERS', undefined),
	reporter: 'list',
	testDir: 'test',
	testMatch: /(.+\.)?(test|spec)\.[jt]s/
};
