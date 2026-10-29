import type { Config } from './runtime/config.ts';

export { raf } from './clock.ts';

export const async_mode = true;

export function test<T extends Config>(config: T): T {
	return config;
}

export function ok(value: unknown): asserts value {
	if (!value) throw new Error(`Expected truthy value, got ${String(value)}`);
}

export const assert_ok: (value: unknown) => asserts value = ok;

export function normalise_inspect_logs(logs: readonly unknown[]): unknown[] {
	const normalised: unknown[] = [];
	for (const log of logs) {
		if (log === 'stack trace') continue;
		if (log instanceof Error) {
			const line = log.stack
				?.trim()
				.split('\n')
				.filter((entry) => !entry.includes('at Module.get_stack'))[1];
			const match = line === undefined ? null : /(at .+) /.exec(line);
			if (match !== null) normalised.push(match[1]);
		} else {
			normalised.push(log);
		}
	}
	return normalised;
}

export interface TraceLog {
	log: unknown;
	highlighted?: boolean;
}

export function normalise_trace_logs(input: readonly unknown[]): TraceLog[] {
	const normalised: TraceLog[] = [];
	const logs = [...input];
	while (logs.length > 0) {
		const log = logs.shift();
		if (log instanceof Error) continue;
		if (typeof log === 'string' && log.includes('%c')) {
			const parts = log.split('%c');
			const first = (parts.shift() ?? '').trim();
			if (first) normalised.push({ log: first });
			while (parts.length > 0) {
				const part = (parts.shift() ?? '').trim();
				const highlighted = logs.shift() === 'color: CornflowerBlue; font-weight: bold';
				if (/\(.+ms\)/.test(part)) continue;
				normalised.push({ log: part, highlighted });
			}
		} else {
			normalised.push({ log });
		}
	}
	return normalised;
}
