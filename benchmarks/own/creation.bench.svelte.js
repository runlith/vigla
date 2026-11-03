import { cell } from '../reactivity/util.svelte.js';
import { fastest } from '../shared/time.js';

const COUNT = 1e5;
const READERS = 10;

let sink = 0;

function createDerived(source) {
	const value = $derived(source.v);
	return () => value;
}

function create(fanout) {
	const sources = COUNT / fanout;
	const iteration = () => {
		const cells = Array.from({ length: sources }, (_, i) => cell(i));
		const kept = [];
		for (const source of cells) {
			for (let j = 0; j < fanout; j++) kept.push(createDerived(source));
		}
		for (let start = 0; start < kept.length; start += READERS) {
			$effect.pre(() => {
				for (let i = start; i < start + READERS; i++) sink += kept[i]();
			});
		}
	};
	return {
		label: `create_kept_1to${fanout}`,
		fn: async () => {
			for (let i = 0; i < 3; i++) $effect.root(iteration)();
			return await fastest(10, () => {
				const destroy = $effect.root(() => {
					for (let i = 0; i < 10; i++) iteration();
				});
				destroy();
			});
		}
	};
}

export default [create(1), create(2), create(4), create(8), create(1000)];
