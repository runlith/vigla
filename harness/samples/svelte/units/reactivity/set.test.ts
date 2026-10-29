import { flushSync } from 'svelte';
import { SvelteSet } from 'svelte/reactivity';
import { assert, test } from 'vitest';

test('set.values()', () => {
	const set = new SvelteSet([1, 2, 3, 4, 5]);

	const log: any = [];

	const cleanup = $effect.root(() => {
		$effect.pre(() => {
			log.push(set.size);
		});

		$effect.pre(() => {
			log.push(set.has(3));
		});

		$effect.pre(() => {
			log.push(Array.from(set));
		});
	});

	flushSync(() => {
		set.delete(3);
	});

	flushSync(() => {
		set.clear();
	});

	assert.deepEqual(log, [5, true, [1, 2, 3, 4, 5], 4, false, [1, 2, 4, 5], 0, false, []]);

	cleanup();
});

test('set.has(...)', () => {
	const set = new SvelteSet([1, 2, 3]);

	const log: any = [];

	const cleanup = $effect.root(() => {
		$effect.pre(() => {
			log.push('has 1', set.has(1));
		});

		$effect.pre(() => {
			log.push('has 2', set.has(2));
		});

		$effect.pre(() => {
			log.push('has 3', set.has(3));
		});
	});

	flushSync(() => {
		set.delete(2);
	});

	flushSync(() => {
		set.add(2);
	});

	assert.deepEqual(log, [
		'has 1',
		true,
		'has 2',
		true,
		'has 3',
		true,
		'has 2',
		false,
		'has 2',
		true
	]);

	cleanup();
});

test('set.delete(...)', () => {
	const set = new SvelteSet([1, 2, 3]);

	assert.equal(set.delete(3), true);
	assert.equal(set.delete(3), false);

	assert.deepEqual(Array.from(set.values()), [1, 2]);
});

test('set.forEach()', () => {
	const set = new SvelteSet([1, 2, 3, 4, 5]);

	const log: any = [];

	const cleanup = $effect.root(() => {
		$effect.pre(() => {
			set.forEach((v) => log.push(v));
		});
	});

	flushSync(() => {
		set.add(6);
	});

	assert.deepEqual(log, [1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 6]);

	cleanup();
});

test('not invoking reactivity when value is not in the set after changes', () => {
	const set = new SvelteSet([1, 2]);

	const log: any = [];

	const cleanup = $effect.root(() => {
		$effect.pre(() => {
			log.push('has 1', set.has(1));
		});

		$effect.pre(() => {
			log.push('has 2', set.has(2));
		});

		$effect.pre(() => {
			log.push('has 3', set.has(3));
		});
	});

	flushSync(() => {
		set.delete(2);
	});

	flushSync(() => {
		set.add(2);
	});

	assert.deepEqual(log, [
		'has 1',
		true,
		'has 2',
		true,
		'has 3',
		false,
		'has 2',
		false,
		'has 3',
		false,
		'has 2',
		true,
		'has 3',
		false
	]);

	cleanup();
});

test('Set.instanceOf', () => {
	assert.equal(new SvelteSet() instanceof Set, true);
});
