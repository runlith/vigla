import assert from 'node:assert';
import { flushSync } from 'svelte';
import { createTest } from './util.svelte.js';

const len = 50;
const iter = 50;

export default createTest('kairo_deep', () => {
	let head = $state.raw(0);
	let current = {
		get v() {
			return head;
		}
	};
	for (let i = 0; i < len; i++) {
		const c = current;
		const next = $derived(c.v + 1);
		current = {
			get v() {
				return next;
			}
		};
	}
	const tail = current;
	let counter = 0;

	const destroy = $effect.root(() => {
		$effect.pre(() => {
			tail.v;
			counter++;
		});
	});

	return {
		destroy,
		run() {
			flushSync(() => {
				head = 1;
			});
			counter = 0;
			for (let i = 0; i < iter; i++) {
				flushSync(() => {
					head = i;
				});
				assert.equal(tail.v, len + i);
			}
			assert.equal(counter, iter);
		}
	};
});
