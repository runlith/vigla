import assert from 'node:assert';
import { flushSync } from 'svelte';
import { createTest } from './util.svelte.js';

function fib(n) {
	if (n < 2) return 1;
	return fib(n - 1) + fib(n - 2);
}

function hard(n) {
	return n + fib(16);
}

const numbers = Array.from({ length: 5 }, (_, i) => i);

export default createTest('mol', () => {
	const res = [];
	let A = $state.raw(0);
	let B = $state.raw(0);
	const C = $derived((A % 2) + (B % 2));
	let previous = null;
	const D = $derived.by(() => {
		const next = numbers.map((i) => i + (A % 2) - (B % 2));
		if (
			previous !== null &&
			next.length === previous.length &&
			next.every((v, i) => v === previous[i])
		) {
			return previous;
		}
		return (previous = next);
	});
	const E = $derived(hard(C + A + D[0]));
	const F = $derived(hard(D[0] && B));
	const G = $derived(C + (C || E % 2) + D[0] + F);

	const destroy = $effect.root(() => {
		$effect.pre(() => {
			res.push(hard(G));
		});
		$effect.pre(() => {
			res.push(G);
		});
		$effect.pre(() => {
			res.push(hard(F));
		});
	});

	return {
		destroy,
		run(i) {
			res.length = 0;
			flushSync(() => {
				B = 1;
				A = 1 + i * 2;
			});
			flushSync(() => {
				A = 2 + i * 2;
				B = 2;
			});
			assert.equal(res[0], 3198);
			assert.equal(res[1], 1601);
			assert.equal(res[2], 3195);
			assert.equal(res[3], 1598);
		}
	};
});
