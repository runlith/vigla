import { PerformanceObserver, performance } from 'node:perf_hooks';

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
