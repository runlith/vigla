import {
	getContext,
	hydratable,
	onDestroy,
	openHydration,
	root,
	setContext
} from 'vigla/internal/index-server';
import { render } from 'vigla/server';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['async-server'],
	async test_ssr({ assert }) {
		const compiled = new URL('./_output/server/main.svelte.js', import.meta.url).pathname;
		const { default: Main } = await import(/* @vite-ignore */ compiled);
		const request = root();
		let released = false;
		let destroyed = false;
		request.run(() => {
			onDestroy(() => {
				destroyed = true;
			});
			setContext('scope', 'request');
			openHydration();
			hydratable('load', () => 42);
			root(() => () => {
				released = true;
			}, request);
		});

		const probe = {};
		const rendered = await request.run(() => render(Main, { props: { probe } }));
		assert.htmlEqual(rendered.body, '<p>request hello</p>');
		assert.strictEqual(probe.owner.parent, request);
		assert.equal(probe.owner.disposed, true);
		assert.equal(probe.signal.aborted, true);
		assert.ok(rendered.head.includes('["load",42]'), rendered.head);
		assert.ok(rendered.head.includes('["greeting","hello"]'), rendered.head);
		assert.equal(request.run(() => getContext('scope')), 'request');

		assert.equal(released, false);
		assert.equal(destroyed, false);
		request.dispose();
		assert.equal(released, true);
		assert.equal(destroyed, true);
		assert.throws(() => setContext('scope', 'none'), /context_without_owner/);
	}
});
