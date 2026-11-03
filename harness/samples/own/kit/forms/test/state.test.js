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

test('a remote form result vanishes after navigating away', async ({ page }) => {
	await page.goto('/ephemeral');
	await hydrated(page);
	await page.fill('#x', 'hi');
	await page.click('button');
	await expect(page.locator('#result')).toHaveText('hi');
	await page.click('#away');
	await page.waitForURL('**/ephemeral/other');
	await page.click('#back');
	await page.waitForURL('**/ephemeral');
	await expect(page.locator('#away')).toBeVisible();
	await expect(page.locator('#result')).toHaveText('');
});

test('a remote form field default follows the route data after a dynamic route change', async ({
	page
}) => {
	await page.goto('/task/1');
	await hydrated(page);
	await page.fill('#title', 'edited');
	await page.click('#list');
	await page.waitForURL('**/task');
	await page.click('#two');
	await page.waitForURL('**/task/2');
	await expect(page.locator('#data')).toHaveText('Hello World 2');
	await expect(page.locator('#title')).toHaveValue('Hello World 2');
});

test('the enhance callback reads every submitted field value', async ({ page }) => {
	await page.goto('/callback');
	await hydrated(page);
	await page.click('#plain');
	await expect(page.locator('#log')).toHaveText('{"intent":"plain","ids":[]}');
	await page.click('#set');
	await page.click('#chosen');
	await expect(page.locator('#log')).toHaveText('{"intent":"chosen","ids":["a"]}');
});
