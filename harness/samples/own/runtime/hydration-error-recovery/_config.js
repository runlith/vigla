import { createContext, hydrate as claim, unmount } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	compileOptions: { dev: true },
	props: { counts: { calls: 0, cleanups: 0 } },
	async test({ assert, mod, window, warnings }) {
		const target = window.document.createElement('main');
		const reset = () => target.innerHTML = '<!--[--><!--]-->';
		reset();
		const counts = { calls: 0, cleanups: 0 };
		const instance = claim(mod.default, { target, props: { counts, fail: true } });
		assert.htmlEqual(target.innerHTML, '<p>2</p>');
		assert.deepEqual(counts, { calls: 2, cleanups: 1 });
		await unmount(instance);
		assert.htmlEqual(target.innerHTML, '');
		assert.deepEqual(counts, { calls: 2, cleanups: 2 });

		reset();
		const strict = { calls: 0, cleanups: 0 };
		assert.throws(
			() => claim(mod.default, { target, props: { counts: strict, fail: true }, recover: false }),
			/hydration_failed/
		);
		assert.deepEqual(strict, { calls: 1, cleanups: 1 });

		target.innerHTML = '<!--[--><p>0</p><!--]-->';
		const invalid = { calls: 0, cleanups: 0 };
		assert.throws(
			() => claim(mod.default, { target, props: { counts: invalid, invalid: true }, recover: false }),
			/state_unsafe_mutation/
		);
		assert.deepEqual(invalid, { calls: 1, cleanups: 1 });

		reset();
		const [read] = createContext();
		let calls = 0;
		assert.throws(() => claim(() => { calls += 1; read(); }, { target }), /missing_context/);
		assert.equal(calls, 1);
		assert.lengthOf(warnings, 4);
		assert.equal(warnings[1].name, 'HierarchyRequestError');
		assert.equal(warnings[3].name, 'HierarchyRequestError');
	}
});
