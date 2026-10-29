import assert from 'node:assert';
import { flushSync } from 'svelte';
import { cell, createTest } from './util.svelte.js';

export default createTest('kairo_mux', () => {
	const heads = new Array(100).fill(null).map(() => cell(0));
	const mux = $derived(Object.fromEntries(heads.map((h) => h.v).entries()));
	const splited = heads
		.map((_, index) => {
			const part = $derived(mux[index]);
			return {
				get v() {
					return part;
				}
			};
		})
		.map((x) => {
			const plus = $derived(x.v + 1);
			return {
				get v() {
					return plus;
				}
			};
		});

	const destroy = $effect.root(() => {
		splited.forEach((x) => {
			$effect.pre(() => {
				x.v;
			});
		});
	});

	return {
		destroy,
		run() {
			for (let i = 0; i < 10; i++) {
				flushSync(() => {
					heads[i].v = i;
				});
				assert.equal(splited[i].v, i + 1);
			}
			for (let i = 0; i < 10; i++) {
				flushSync(() => {
					heads[i].v = i * 2;
				});
				assert.equal(splited[i].v, i * 2 + 1);
			}
		}
	};
});
