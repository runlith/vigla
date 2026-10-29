import * as vitest from 'vitest';
import { ruling, runs, type Manifest } from '../manifest.ts';
import { selects } from '../scope.ts';

export * from 'vitest';

type Body = () => unknown;

const path: string[] = [];
let governed: { suite: string; manifest: Manifest } | null = null;

export const registered: string[] = [];

export function govern(suite: string, manifest: Manifest, prefix: readonly string[] = []): void {
	governed = { suite, manifest };
	path.splice(0, path.length, ...prefix);
}

export function describe(name: string, body: Body): void {
	const at = [...path, name];
	vitest.describe(name, () => {
		const outer = path.splice(0, path.length, ...at);
		try {
			body();
		} finally {
			path.splice(0, path.length, ...outer);
		}
	});
}

function register(name: string, body: Body, skipped: boolean, timeout?: number): void {
	const key = [...path, name].join(' > ');
	registered.push(key);
	if (governed === null) throw new Error(`${key} registered outside a governed suite`);
	const suite = governed.suite;
	if (!selects(`svelte/${suite}`, key)) return;
	const rule = ruling(governed.manifest, key);
	if (rule === undefined) {
		vitest.it(name, () => vitest.assert.fail(`${suite}/${key} has no status in the manifest`));
	} else if (runs(rule.status) && !skipped) {
		vitest.it(name, body, timeout);
	} else {
		vitest.it.skip(name, body);
	}
}

export function it(name: string, body: Body, timeout?: number): void {
	register(name, body, false, timeout);
}

it.skip = (name: string, body: Body): void => register(name, body, true);

export const test = it;
