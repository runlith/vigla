import assert from 'node:assert';
import { flushSync } from 'svelte';
import { createTest } from './util.svelte.js';

const width = 10;

function count(number) {
	return new Array(number)
		.fill(0)
		.map((_, i) => i + 1)
		.reduce((x, y) => x + y, 0);
}

export default createTest('kairo_triangle', () => {
	let head = $state.raw(0);
	let current = {
		get v() {
			return head;
		}
	};
	const list = [];
	for (let i = 0; i < width; i++) {
		const c = current;
		list.push(current);
		const next = $derived(c.v + 1);
		current = {
			get v() {
				return next;
			}
		};
	}
	const sum = $derived(list.map((x) => x.v).reduce((a, b) => a + b, 0));
	let counter = 0;

	const destroy = $effect.root(() => {
		$effect.pre(() => {
			sum;
			counter++;
		});
	});

	return {
		destroy,
		run() {
			const constant = count(width);
			flushSync(() => {
				head = 1;
			});
			assert.equal(sum, constant);
			counter = 0;
			for (let i = 0; i < 100; i++) {
				flushSync(() => {
					head = i;
				});
				assert.equal(sum, constant - width + i * width);
			}
			assert.equal(counter, 100);
		}
	};
});
