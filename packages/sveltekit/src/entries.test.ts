import { kit } from '@vigla/kit/vite';
import { expect, test } from 'vitest';
import { applyReroute } from './adapter.ts';

test("the adapter entry follows SvelteKit's reroute header without the plugin, beside Kit's own", async () => {
	await kit();
	const response = new Response(null, {
		headers: { 'x-sveltekit-rerouted-url': 'https://app.test/next' }
	});
	const rerouted = await applyReroute(response, (url) => new Response(url.href));
	expect(await rerouted.text()).toBe('https://app.test/next');
});
