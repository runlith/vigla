import { cell, effect, getOwner, root, untrack } from 'vigla';
import { flushSync, settled } from 'svelte';
import { test } from '@vigla/harness/helpers';

const app = root();
const value = cell(0);

const hooks = {
	effectRoot(build) {
		const owner = root(build);
		return () => owner.dispose();
	},
	watch(read, initial, react) {
		let previous = initial;
		return hooks.effectRoot(() => {
			effect(() => {
				const next = read();
				untrack(() => {
					if (previous === next) return;
					previous = next;
					react(next);
				});
			});
		});
	},
	cell: () => cell(undefined),
	start: 'mount'
};

export default test({
	mode: ['client'],
	props: { app, value },
	html: '<button>leave</button> <p>page</p>',
	async test({ assert, instance, target, logs }) {
		flushSync(() => target.querySelector('button').click());
		value.current = 1;
		await settled();
		assert.htmlEqual(target.innerHTML, '<button>leave</button>');
		assert.deepEqual(logs, ['service 0', 'service 1']);
		const children = app.run(() => instance.childRoots(app));
		const first = children.current();
		children.next();
		const second = children.current();
		assert.equal(first.disposed, false);
		assert.equal(second.disposed, false);
		app.dispose();
		assert.equal(first.disposed, true);
		assert.equal(second.disposed, true);
		value.current = 2;
		flushSync();
		assert.deepEqual(logs, ['service 0', 'service 1', 'service gone']);

		const flag = hooks.cell();
		flag.current = false;
		const seen = [];
		const stop = hooks.watch(() => flag.current, false, (next) => seen.push(next));
		flushSync();
		flag.current = true;
		flushSync();
		stop();
		flag.current = false;
		flushSync();
		assert.deepEqual(seen, [true]);
		assert.equal(getOwner(), null);
	}
});
