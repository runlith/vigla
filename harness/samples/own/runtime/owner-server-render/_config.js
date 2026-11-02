import {
	getAbortSignal,
	getContext,
	getOwner,
	hydratable,
	onDestroy,
	openHydration,
	root,
	setContext
} from 'vigla/internal/index-server';
import { render } from 'vigla/server';
import { render as renderAdapter } from 'svelte/server';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['async-server'],
	async test_ssr({ assert }) {
		const compiled = new URL('./_output/server/main.svelte.js', import.meta.url).pathname;
		const { default: Main } = await import(/* @vite-ignore */ compiled);
		const request = root();
		let released = false;
		let destroyed = false;
		let finalValue = 1;
		let snapshots = 0;
		request.run(() => {
			onDestroy(() => {
				destroyed = true;
			});
			setContext('scope', 'request');
			root(() => () => {
				released = true;
			}, request);
		});

		let service;
		let serviceSignal;
		let serviceDestroyed = false;
		const isolated = request.run(() => render(
			(out) => {
				setContext('local', 'render');
				root(() => out.push([
					String(getContext('scope')),
					getContext('given'),
					getContext('local')
				].join(' ')), getOwner());
			},
			{ context: new Map([['given', 'isolated']]), inheritContext: false }
		));
		assert.htmlEqual(isolated.body, 'undefined isolated render');
		request.run(() => {
			openHydration({ beforeSnapshot() {
				assert.strictEqual(getOwner(), request);
				snapshots++;
				if (snapshots === 1) hydratable('final', () => finalValue);
			} });
			hydratable('load', () => 42);
		});
		const alias = renderAdapter((out) => out.push('body'));
		assert.equal(alias.html, alias.body);
		const awaited = await alias;
		assert.htmlEqual(awaited.body, 'body');
		assert.throws(() => awaited.html, /html_deprecated/);
		const probe = { finished() {
			finalValue = 2;
			assert.equal(getContext('component'), 'render');
			setContext('component', 'continued');
			assert.equal(getContext('component'), 'continued');
			request.run(() => assert.equal(getContext('component'), undefined));
			service = root(undefined, request);
			service.run(() => {
				setContext('scope', 'service');
				onDestroy(() => { serviceDestroyed = true; });
				serviceSignal = getAbortSignal();
			});
		} };
		const rendered = await request.run(() => render(Main, { props: { probe } }));
		assert.htmlEqual(rendered.body, '<p>request hello</p>');
		assert.ok(rendered.head.includes('<title>scope:request</title>'), rendered.head);
		assert.strictEqual(probe.owner.parent, request);
		assert.equal(probe.owner.disposed, true);
		assert.equal(probe.signal.aborted, true);
		assert.ok(rendered.head.includes('["load",42]'), rendered.head);
		assert.ok(rendered.head.includes('["greeting","hello"]'), rendered.head);
		assert.ok(rendered.head.includes('["final",2]'), rendered.head);
		await request.run(() => render(Main, { props: { probe: {} } }));
		assert.equal(snapshots, 2);
		const empty = root();
		empty.run(() => openHydration({ beforeSnapshot: () => hydratable('only', () => 3) }));
		const published = await empty.run(() => render(() => {}));
		assert.ok(published.head.includes('["only",3]'), published.head);
		empty.dispose();
		assert.equal(request.run(() => getContext('scope')), 'request');
		assert.equal(service.run(() => getContext('scope')), 'service');
		assert.equal(serviceDestroyed, false);
		assert.equal(serviceSignal.aborted, false);

		assert.equal(released, false);
		assert.equal(destroyed, false);
		request.dispose();
		assert.equal(serviceDestroyed, true);
		assert.equal(serviceSignal.aborted, true);
		assert.equal(released, true);
		assert.equal(destroyed, true);
		assert.throws(() => setContext('scope', 'none'), /context_without_owner/);
	}
});
