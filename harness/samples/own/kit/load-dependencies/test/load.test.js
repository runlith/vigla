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

test('awaiting parent sends its fresh data into the merged page', async ({ page }) => {
	await page.goto('/parent/a');
	await page.locator('main[data-ready=true]').waitFor();
	const before = await page.locator('output').getAttribute('data-version');
	await page.getByRole('link', { name: 'b', exact: true }).click();
	await expect(page).toHaveURL(/\/parent\/b$/);
	await expect.poll(() => page.locator('output').getAttribute('data-seen')).not.toBe(before);
	const seen = await page.locator('output').getAttribute('data-seen');
	await expect(page.locator('output')).toHaveAttribute('data-version', seen);
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
