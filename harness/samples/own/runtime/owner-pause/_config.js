import { flushSync, mount, root, state } from 'vigla';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	props: { model: { count: 1, items: ['a'] }, held: {} },
	async test({ assert, mod }) {
		const target = document.createElement('div');
		document.body.append(target);
		const model = state({ count: 1, items: ['a'] });
		const held = {};
		const tab = root();
		tab.run(() => mount(mod.default, { target, props: { model: model.current, held } }));
		flushSync();
		const beside = () => target.querySelector('p').textContent;
		const rows = () => [...target.querySelectorAll('li')];
		const frame = () =>
			[
				target.querySelector('span').textContent,
				target.querySelector('b')?.textContent ?? '',
				rows()
					.map((row) => row.textContent)
					.join(',')
			].join(' | ');
		assert.equal(frame(), '1 |  | a');
		const first = rows()[0];

		held.owner.pause();
		await Promise.resolve();
		model.current.count = 2;
		model.current.items.push('b');
		flushSync();
		model.current.count = 3;
		model.current.items.push('c');
		flushSync();
		assert.equal(beside(), '3');
		assert.equal(frame(), '1 |  | a');

		held.owner.resume();
		flushSync();
		assert.equal(frame(), '3 | many | a,b,c');
		assert.equal(rows()[0], first);

		model.current.count = 1;
		flushSync();
		assert.equal(frame(), '1 |  | a,b,c');

		held.owner.pause();
		await Promise.resolve();
		model.current.count = 5;
		flushSync();
		tab.dispose();
		assert.equal(target.innerHTML, '');
		target.remove();
	}
});
