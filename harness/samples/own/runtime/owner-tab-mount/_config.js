import { flushSync, hydratable, hydrated, mount, openHydration, root, setContext } from 'vigla';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	html: '<p>none c1</p>',
	test({ assert, mod }) {
		const Main = mod.default;
		const tab = root();
		tab.run(() => setContext('scope', 'tab'));

		const first = document.createElement('div');
		const second = document.createElement('div');
		document.body.append(first, second);
		tab.run(() => {
			mount(Main, { target: first });
			mount(Main, { target: second });
		});
		flushSync();
		assert.htmlEqual(first.innerHTML, '<p>tab c2</p>');
		assert.htmlEqual(second.innerHTML, '<p>tab c3</p>');

		window.__vigla = { h: new Map([['payload', 'server']]) };
		const close = tab.run(() => openHydration());
		assert.equal(
			tab.run(() => hydratable('payload', () => 'client')),
			'server'
		);
		assert.equal(
			tab.run(() => hydrated('payload', () => 'client')),
			'server'
		);
		assert.equal(
			tab.run(() => hydrated('absent', () => 'client')),
			'client'
		);
		close();
		assert.equal(
			tab.run(() => hydratable('payload', () => 'client')),
			'client'
		);
		assert.equal(window.__vigla.h, undefined);

		tab.dispose();
		first.remove();
		second.remove();
	}
});
