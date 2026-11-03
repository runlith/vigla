import { fastest } from '../shared/time.js';
import { cell } from './util.svelte.js';

const COUNT = 1e5;

function createSources(n, sources) {
	for (let i = 0; i < n; i++) {
		sources[i] = cell(i);
	}
	return sources;
}

function createDerived(source) {
	const value = $derived(source.v);
}

function sbench(label, count, sources, fn) {
	return {
		label,
		fn: async () => {
			for (let i = 0; i < 3; i++) {
				fn(count, createSources(sources, []));
			}
			return await fastest(10, () => {
				const destroy = $effect.root(() => {
					for (let i = 0; i < 10; i++) {
						fn(count, createSources(sources, []));
					}
				});
				destroy();
			});
		}
	};
}

export default [
	sbench('sbench_create_signals', COUNT, COUNT, createSources),
	sbench('sbench_create_0to1', COUNT, 0, (n) => {
		for (let i = 0; i < n; i++) {
			const value = $derived(i);
		}
	}),
	sbench('sbench_create_1to1', COUNT, COUNT, (n, sources) => {
		for (let i = 0; i < n; i++) {
			createDerived(sources[i]);
		}
	}),
	sbench('sbench_create_2to1', COUNT / 2, COUNT, (n, sources) => {
		for (let i = 0; i < n; i++) {
			const value = $derived(sources[i * 2].v + sources[i * 2 + 1].v);
		}
	}),
	sbench('sbench_create_4to1', COUNT / 4, COUNT, (n, sources) => {
		for (let i = 0; i < n; i++) {
			const value = $derived(
				sources[i * 4].v + sources[i * 4 + 1].v + sources[i * 4 + 2].v + sources[i * 4 + 3].v
			);
		}
	}),
	sbench('sbench_create_1000to1', COUNT / 1000, COUNT, (n, sources) => {
		for (let i = 0; i < n; i++) {
			const offset = i * 1000;
			const value = $derived.by(() => {
				let sum = 0;
				for (let i = 0; i < 1000; i++) {
					sum += sources[offset + i].v;
				}
				return sum;
			});
		}
	}),
	sbench('sbench_create_1to2', COUNT, COUNT / 2, (n, sources) => {
		for (let i = 0; i < n / 2; i++) {
			const source = sources[i];
			createDerived(source);
			createDerived(source);
		}
	}),
	sbench('sbench_create_1to4', COUNT, COUNT / 4, (n, sources) => {
		for (let i = 0; i < n / 4; i++) {
			const source = sources[i];
			createDerived(source);
			createDerived(source);
			createDerived(source);
			createDerived(source);
		}
	}),
	sbench('sbench_create_1to8', COUNT, COUNT / 8, (n, sources) => {
		for (let i = 0; i < n / 8; i++) {
			const source = sources[i];
			createDerived(source);
			createDerived(source);
			createDerived(source);
			createDerived(source);
			createDerived(source);
			createDerived(source);
			createDerived(source);
			createDerived(source);
		}
	}),
	sbench('sbench_create_1to1000', COUNT, COUNT / 1000, (n, sources) => {
		for (let i = 0; i < n / 1000; i++) {
			const source = sources[i];
			for (let j = 0; j < 1000; j++) {
				createDerived(source);
			}
		}
	})
];
