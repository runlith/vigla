import { flushSync, mount, root } from 'vigla';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	props: { clicks: [] },
	html: '<button>press</button>',
	test({ assert, mod }) {
		const target = document.createElement('div');
		document.body.append(target);
		const clicks = [];
		const removed = [];
		const remove = target.removeEventListener;
		target.removeEventListener = function (type, ...rest) {
			removed.push(type);
			return remove.call(this, type, ...rest);
		};
		const tab = root();
		tab.run(() => mount(mod.default, { target, props: { clicks } }));
		flushSync();
		const button = target.querySelector('button');
		button.click();
		tab.dispose();
		assert.equal(target.innerHTML, '');
		assert.ok(removed.includes('click'), removed.join());
		target.append(button);
		button.click();
		assert.deepEqual(clicks, ['click']);
		target.remove();

		const early = document.createElement('div');
		document.body.append(early);
		const added = [];
		const add = early.addEventListener;
		early.addEventListener = function (type, ...rest) {
			added.push(type);
			return add.call(this, type, ...rest);
		};
		const ended = root();
		ended.run(() =>
			mount(mod.default, { target: early, props: { clicks, initialized: () => ended.dispose() } })
		);
		flushSync();
		assert.equal(early.innerHTML, '');
		assert.deepEqual(added, []);
		early.remove();
	}
});
