import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

const methods = [Array.prototype.includes, Array.prototype.indexOf, Array.prototype.lastIndexOf];

export default test({
	mode: ['client', 'hydrate'],
	compileOptions: { dev: true },
	async test({ assert, target, warnings, instance }) {
		assert.deepEqual([Array.prototype.includes, Array.prototype.indexOf, Array.prototype.lastIndexOf], methods);
		const [run, child] = target.querySelectorAll('button');
		flushSync(() => run.click());
		assert.deepEqual(JSON.parse(target.querySelector('p').textContent), {
			items: [], customResult: true, index: -1, last: -1, found: true, absent: false,
			counts: { receiver: 1, key: 1, coercion: 2, rhs: 1, from: 1 },
			order: ['receiver', 'method', 'argument', 'call'],
			assignmentOrder: ['receiver', 'key', 'coercion', 'rhs', 'coercion'],
			changing: { source: null, target: [] }, chosen: [9],
			keyTrace: [['string', true, 'source'], ['string', true, 'target']]
		});
		assert.deepEqual(await instance.edges(), {
			optionalResult: undefined, argumentsCalled: 0,
			yielded: { value: [], done: false }, resumed: { value: [7, 8], done: true },
			target: { items: [7] }, found: false, sameError: true, stored: [], assigned: [1],
			waiting: [], waited: [2], waits: 1, skipped: true
		});
		assert.equal(warnings.length, 7);
		assert.ok(warnings[0].startsWith('Assignment to `items` property'));
		assert.ok(warnings[1].includes('array.indexOf(...)'));
		assert.ok(warnings[2].includes('array.lastIndexOf(...)'));
		assert.ok(warnings[3].startsWith('Assignment to `target` property'));
		for (const warning of warnings.slice(4)) assert.ok(warning.startsWith('Assignment to `items` property'));
		flushSync(() => child.click());
		assert.equal(warnings.length, 9);
		assert.ok(warnings[7].startsWith('Assignment to `items` property'));
		assert.ok(warnings[8].startsWith('Mutating unbound props (`value`,'));
	}
});
