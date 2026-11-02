import { PerformanceObserver, performance } from 'node:perf_hooks';

export function busy() {
	let a = 0;
	for (let i = 0; i < 100; i++) {
		a++;
	}
}

let initial = 0;

class Holder {
	v = $state.raw(initial);
}

export function cell(value) {
	initial = value;
	return new Holder();
}

async function track(fn) {
	globalThis.gc();
	const entries = [];
	const observer = new PerformanceObserver((list) => entries.push(...list.getEntries()));
	observer.observe({ entryTypes: ['gc'] });
	const start = performance.now();
	fn();
	const end = performance.now();
	await new Promise((done) => setTimeout(done, 10));
	const gc = entries
		.filter((entry) => entry.startTime >= start && entry.startTime < end)
		.reduce((total, entry) => total + entry.duration, 0);
	observer.disconnect();
	return { time: end - start, gc };
}

export async function fastest(times, fn) {
	return fastestFresh(times, () => fn);
}

export async function fastestFresh(times, prepare) {
	let best = null;
	for (let i = 0; i < times; i++) {
		const result = await track(prepare());
		if (best === null || result.time < best.time) best = result;
	}
	return best;
}

export function createTest(label, setup) {
	return [
		{
			label: `${label}_owned`,
			fn: async () => {
				let run;
				let destroy;
				const destroyOwned = $effect.root(() => {
					for (let i = 0; i < 10; i++) {
						const warm = setup();
						warm.run(0);
						warm.destroy();
					}
					({ run, destroy } = setup());
				});
				const result = await fastest(10, () => {
					for (let i = 0; i < 1000; i++) run(i);
				});
				destroy();
				destroyOwned();
				return result;
			}
		},
		{
			label: `${label}_unowned`,
			fn: async () => {
				for (let i = 0; i < 10; i++) {
					const warm = setup();
					warm.run(0);
					warm.destroy();
				}
				const { run, destroy } = setup();
				const result = await fastest(10, () => {
					for (let i = 0; i < 1000; i++) run(i);
				});
				destroy();
				return result;
			}
		}
	];
}
