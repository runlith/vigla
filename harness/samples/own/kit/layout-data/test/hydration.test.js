import { expect, test as base } from '@playwright/test';
import { gate } from '@vigla/harness/kit/gate';

const test = base.extend({
	harness_gate: [
		async ({}, use, info) => {
			gate(info);
			await use(undefined);
		},
		{ auto: true }
	]
});

test('grouped server data survives initial hydration', async ({ page }) => {
	const effects = [];
	const errors = [];
	page.on('console', (message) => {
		if (message.type() === 'log') effects.push(message.text());
	});
	page.on('pageerror', (error) => {
		errors.push(error.message);
		console.error(error.stack ?? error.message);
	});

	await page.goto('/path');
	await expect(page.getByText('this is the child', { exact: true })).toBeVisible();
	await expect.poll(() => [...new Set(effects)]).toEqual(['root child']);
	effects.length = 0;

	await page.reload();
	await expect(page.getByText('this is the child', { exact: true })).toBeVisible();
	await expect.poll(() => [...new Set(effects)]).toEqual(['root child']);
	expect(errors).toEqual([]);
});
