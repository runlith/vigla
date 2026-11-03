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

const hydrated = (page) => expect(page.locator('body')).toHaveAttribute('data-ready', 'true');

test('enhance submits a formData reassigned by the submit function', async ({ page }) => {
	await page.goto('/enhance-data');
	await hydrated(page);
	await page.click('button');
	await expect(page.locator('#form')).toHaveText('{"greeting":"Hello World"}');
});

test('page.form survives invalidateAll like the form prop', async ({ page }) => {
	await page.goto('/invalidate');
	await hydrated(page);
	await page.click('#add');
	await expect(page.locator('#page')).toHaveText('{"added":1}');
	const loads = Number(await page.locator('#loads').textContent());
	await page.click('#reload');
	await expect(page.locator('#loads')).toHaveText(String(loads + 1));
	await expect(page.locator('#prop')).toHaveText('{"added":1}');
	await expect(page.locator('#page')).toHaveText('{"added":1}');
});
