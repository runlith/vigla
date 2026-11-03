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

test('enumerating params tracks optional keys before they exist', async ({ page }) => {
	await page.goto('/params');
	await page.locator('main[data-ready=true]').waitFor();
	await expect(page.locator('output')).toHaveText('{}');
	await page.getByRole('link', { name: 'aa', exact: true }).click();
	await expect(page.locator('output')).toHaveText('{"a":"aa"}');
	await page.getByRole('link', { name: 'bb', exact: true }).click();
	await expect(page.locator('output')).toHaveText('{"a":"aa","b":"bb"}');
});

test('an actions-only server module needs no navigation data request', async ({ page }) => {
	await page.goto('/');
	await page.locator('main[data-ready=true]').waitFor();
	const requests = [];
	page.on('request', (request) => {
		if (new URL(request.url()).pathname.endsWith('/__data.json')) requests.push(request.url());
	});
	await page.getByRole('link', { name: 'actions', exact: true }).click();
	await expect(page.getByRole('heading')).toHaveText('actions');
	expect(requests).toEqual([]);
});
