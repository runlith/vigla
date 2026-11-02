import { flushSync } from 'svelte';
import { cell, fastest } from '../reactivity/util.svelte.js';

function measure(label, setup) {
	return {
		label,
		fn: async () => {
			for (let i = 0; i < 3; i++) {
				const warm = setup();
				warm.run();
				warm.destroy();
			}
			const { run, destroy } = setup();
			const result = await fastest(10, run);
			destroy();
			return result;
		}
	};
}

export default [
	measure('effect_writes_1000', () => {
		const rows = Array.from({ length: 1000 }, (_, i) => cell(i));
		let trigger = $state.raw(0);
		let n = 0;
		const destroy = $effect.root(() => {
			$effect.pre(() => {
				const t = trigger;
				for (const row of rows) row.v = t;
			});
		});
		return {
			destroy,
			run() {
				for (let i = 0; i < 200; i++) {
					flushSync(() => {
						trigger = ++n;
					});
				}
			}
		};
	}),
	measure('write_flush_one_reader', () => {
		let source = $state.raw(0);
		let sink = 0;
		let n = 0;
		const destroy = $effect.root(() => {
			$effect.pre(() => {
				sink += source;
			});
		});
		return {
			destroy,
			run() {
				for (let i = 0; i < 20000; i++) {
					flushSync(() => {
						source = ++n;
					});
				}
			}
		};
	}),
	measure('effect_reads_1000', () => {
		const sources = Array.from({ length: 1000 }, (_, i) => cell(i));
		let trigger = $state.raw(0);
		let sink = 0;
		let n = 0;
		const destroy = $effect.root(() => {
			$effect.pre(() => {
				trigger;
				for (const source of sources) sink += source.v;
			});
		});
		return {
			destroy,
			run() {
				for (let i = 0; i < 200; i++) {
					flushSync(() => {
						trigger = ++n;
					});
				}
			}
		};
	}),
	measure('effect_reads_1000_writes_1000', () => {
		const sources = Array.from({ length: 1000 }, (_, i) => cell(i));
		const rows = Array.from({ length: 1000 }, (_, i) => cell(i));
		const trigger = cell(0);
		let sink = 0;
		let n = 0;
		const destroy = $effect.root(() => {
			$effect.pre(() => {
				const t = trigger.v;
				for (const source of sources) sink += source.v;
				for (const row of rows) row.v = t;
			});
		});
		return {
			destroy,
			run() {
				for (let i = 0; i < 200; i++) {
					flushSync(() => {
						trigger.v = ++n;
					});
				}
			}
		};
	}),
	measure('writes_1000_effects_1000', () => {
		const sources = Array.from({ length: 1000 }, (_, i) => cell(i));
		let n = 0;
		const destroy = $effect.root(() => {
			for (const source of sources) {
				$effect.pre(() => {
					source.v;
				});
			}
		});
		return {
			destroy,
			run() {
				for (let i = 0; i < 50; i++) {
					n++;
					flushSync(() => {
						for (const source of sources) source.v = n;
					});
				}
			}
		};
	})
];
