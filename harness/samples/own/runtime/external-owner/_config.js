import { cell, effect, external, flushSync, root } from 'vigla';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client', 'server', 'async-server'],
	html: '<p>0</p>',
	test({ assert }) {
		let subscribers = 0;
		let current = 1;
		let emit;
		const source = {
			subscribe(run) {
				subscribers++;
				emit = run;
				run(current);
				return () => subscribers--;
			}
		};
		const owner = root();
		const selected = cell(source);
		const value = owner.run(() => external(() => selected.current));
		const seen = [];
		try {
			owner.run(() => effect(() => { seen.push(value.current); }));
			flushSync();
			assert.equal(subscribers, 1);
			selected.current = undefined;
			value.refresh(undefined);
			assert.equal(subscribers, 0);
			flushSync();
			selected.current = source;
			flushSync();
			assert.equal(subscribers, 1);
			current = 2;
			emit(current);
			flushSync();
			assert.deepEqual(seen, [1, undefined, 1, 2]);
		} finally {
			owner.dispose();
		}
		assert.equal(subscribers, 0);
		assert.equal(value.current, 2);
		assert.equal(subscribers, 0);
	}
});
