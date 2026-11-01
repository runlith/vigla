import { getText } from '~utils';

test('should render component imported via svelte field in package.json', async () => {
	await expect.poll(() => getText('#test-id')).toBe('svelte field works');
});
