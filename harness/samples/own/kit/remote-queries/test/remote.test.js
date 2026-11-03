import { expect, test } from './gate.js';

test('a command sees the rerouted route', async ({ page, open }) => {
	await open('/reroute/original');
	await page.getByRole('button', { name: 'run' }).click();
	await expect(page.locator('#result')).toHaveText('/reroute/actual /reroute/original');
});

test('a command called from an endpoint may request refreshes', async ({ page, open }) => {
	await open('/requested');
	await page.getByRole('button', { name: 'run' }).click();
	await expect(page.locator('#result')).toHaveText('200 {"result":"bumped"}');
});

test('a command called in an effect runs once', async ({ page, open, remote }) => {
	await open('/effect-command');
	await page.waitForTimeout(1500);
	expect(remote.filter((request) => request.method() === 'POST')).toHaveLength(1);
});

test('hovering a link does not redirect through a preloaded query', async ({ page, open }) => {
	await open('/prefetch-redirect');
	await page.locator('#link').hover();
	await page.waitForTimeout(1500);
	expect(new URL(page.url()).pathname).toBe('/prefetch-redirect');
	await page.locator('#link').click();
	await expect(page.locator('#where')).toHaveText('auth');
	expect(new URL(page.url()).pathname).toBe('/prefetch-redirect/auth');
});

test('a refreshed query that redirects inside a form navigates', async ({ page, open }) => {
	await open('/form-refresh-redirect');
	await expect(page.locator('#count')).toHaveText('0');
	await page.getByRole('button', { name: 'increment' }).click();
	await expect(page.locator('#count')).toHaveText('1');
	await page.getByRole('button', { name: 'increment' }).click();
	await expect(page.locator('#where')).toHaveText('reset');
});

test('hovering a link preloads its query at most once', async ({ page, open, remote }) => {
	await open('/fork-preload');
	await page.locator('#link').hover();
	await page.waitForTimeout(1500);
	expect(
		remote.filter((request) => request.url().includes('aboutData')).length
	).toBeLessThanOrEqual(1);
});

test('a redirect from a query crossing a layout boundary renders the new page', async ({
	open,
	page
}) => {
	await open('/layout-crossing');
	await page.locator('#link').click();
	await expect(page).toHaveURL(/\/layout-crossing-login$/);
	await expect(page.locator('#where')).toHaveText('login');
	await expect(page.locator('#crumbs')).toHaveCount(0);
});

test('live connections close promptly when their readers unmount', async ({
	open,
	page,
	request
}) => {
	await open('/live-release');
	await expect(page.locator('.tick')).toHaveText(['1', '2', '3']);
	await page.locator('#away').click();
	await expect(page.locator('#where')).toHaveText('away');
	await expect
		.poll(async () => (await request.get('/live-release/open')).json(), { timeout: 5000 })
		.toBe(0);
});

test('a live query reading another query follows its updates', async ({ open, page }) => {
	await open('/live-nested');
	await expect(page.locator('#value')).toHaveText('0');
	for (const expected of ['1', '2', '3']) {
		await page.getByRole('button', { name: 'bump' }).click();
		await expect(page.locator('#value')).toHaveText(expected);
	}
	await page.waitForTimeout(500);
	await expect(page.locator('#value')).toHaveText('3');
});
