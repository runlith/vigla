import { realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const svelte = dirname(realpathSync(createRequire(import.meta.url).resolve('svelte/package.json')));

function internal<T>(path: string): Promise<T> {
	return import(join(svelte, 'src', 'internal', path)) as Promise<T>;
}

const batch = await internal<{ clear(): void }>('client/reactivity/batch.js');
const hydration = await internal<{ readonly hydrating: boolean }>('client/dom/hydration.js');
const context = await internal<{ readonly ssr_context: unknown }>('server/context.js');
const timing = await internal<{
	raf: { tick(callback: FrameRequestCallback): void; now(): number; tasks: Set<unknown> };
}>('client/timing.js');

timing.raf.tick = (callback) => {
	requestAnimationFrame(callback);
};
timing.raf.now = () => performance.now();

interface Disclosed {
	__svelte?: { h?: unknown; uid?: number };
}

export function before(): void {
	const global = globalThis as Disclosed;
	delete global.__svelte?.h;
	(global.__svelte ??= {}).uid = 1;
	timing.raf.tasks.clear();
}

export function after(): void {
	const hydrating = hydration.hydrating;
	batch.clear();
	if (hydrating) throw new Error('Hydration state was not cleared');
	if (context.ssr_context !== null) throw new Error('ssr_context was not cleared');
}
