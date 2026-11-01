import { describe, expect, it } from 'vitest';
import { getText, IS_SVELTE_BASELINE } from '~utils';

describe.skipIf(IS_SVELTE_BASELINE)('kit-async', async () => {
	it('works', async () => {
		expect(await getText('h1')).toBe('Hello async world!');
		expect(await getText('span')).toBe('Wait for it ...');
		await expect.poll(() => getText('span'), { timeout: 10000 }).toBe('foo');
	});
});
