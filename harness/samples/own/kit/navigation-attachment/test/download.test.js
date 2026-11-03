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

test('navigation callbacks continue after an attachment download', async ({ page }) => {
	await page.route('https://download.test/file.pdf', (route) =>
		route.fulfill({
			status: 200,
			headers: {
				'content-type': 'application/pdf',
				'content-disposition': 'attachment; filename="file.pdf"'
			},
			body: 'file'
		})
	);

	await page.goto('/');
	await expect(page.locator('body')).toHaveAttribute('data-hydrated', 'yes');
	const download = page.waitForEvent('download');
	await page.getByRole('link', { name: 'download' }).click();
	await download;
	await page.getByRole('link', { name: 'about' }).click();
	await expect(page.getByRole('heading', { name: 'about' })).toBeVisible();
	await expect(page.locator('#paths')).toHaveText('/file.pdf|/about');
});
