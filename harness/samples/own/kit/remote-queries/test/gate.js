import { test as base } from '@playwright/test';
import { gate } from '@vigla/harness/kit/gate';

export { expect } from '@playwright/test';

export const test = base.extend({
	harness_gate: [
		async ({}, use, info) => {
			gate(info);
			await use(undefined);
		},
		{ auto: true }
	],
	open: async ({ page }, use) => {
		await use(async (path) => {
			const response = await page.goto(path);
			await page.locator('html[data-ready]').waitFor({ state: 'attached' });
			return response;
		});
	},
	remote: async ({ page }, use) => {
		const requests = [];
		page.on('request', (request) => {
			if (request.url().includes('/_app/remote/')) requests.push(request);
		});
		await use(requests);
	},
	logs: async ({ page }, use) => {
		const messages = [];
		page.on('console', (message) => messages.push(message.text()));
		page.on('pageerror', (error) => messages.push(`pageerror: ${error.message}`));
		await use(messages);
	}
});
