import { cell, fastestFresh } from '../reactivity/util.svelte.js';

function rows(count) {
	const selected = cell(0);
	const cells = Array.from({ length: count }, (_, i) => cell(i));
	return $effect.root(() => {
		for (const row of cells) {
			$effect.pre(() => {
				row.v === selected.v;
			});
		}
	});
}

function unmount(count, warmups, times) {
	return {
		label: `unmount_readers_${count}`,
		fn: async () => {
			for (let i = 0; i < warmups; i++) rows(count)();
			return fastestFresh(times, () => rows(count));
		}
	};
}

export default [unmount(1000, 3, 10), unmount(10000, 2, 10), unmount(100000, 1, 3)];
