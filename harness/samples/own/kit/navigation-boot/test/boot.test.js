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

test('a second back during startup renders the URL in history', async ({ page }) => {
	await page.route('https://outside.test/**', (route) =>
		route.fulfill({ status: 200, contentType: 'text/html', body: '<p>outside</p>' })
	);
	await page.goto('/');
	await expect(page.locator('body')).toHaveAttribute('data-hydrated', 'yes');
	await page.locator('#slug-link').click();
	await expect(page.locator('#slug')).toHaveText('slug: 1');
	await page.goto('https://outside.test/');

	let release;
	const held = new Promise((resolve) => (release = resolve));
	let waiting = false;
	await page.route('**/src/hooks.client.js*', async (route) => {
		waiting = true;
		await held;
		await route.continue();
	});
	try {
		await page.goBack({ waitUntil: 'commit' });
		await expect.poll(() => waiting).toBe(true);
		await page.evaluate(() => history.back());
		await page.waitForURL('http://localhost:6122/');
	} finally {
		release();
	}
	await expect(page.locator('body')).toHaveAttribute('data-hydrated', 'yes');
	await expect(page.locator('#route')).toHaveText('/');
	await expect(page.getByText('home page')).toBeVisible();
	await expect(page.locator('#slug')).toHaveCount(0);
});

test('a link clicked while mounting starts a client navigation', async ({ page }) => {
	await page.goto('/?auto=1');
	await page.waitForURL('**/slug/1');
	await expect(page.locator('#slug')).toHaveText('slug: 1');
	await expect.poll(() => page.evaluate(() => sessionStorage.getItem('before'))).toBe('/slug/1');
	await expect.poll(() => page.evaluate(() => sessionStorage.getItem('boots'))).toBe('1');
});
