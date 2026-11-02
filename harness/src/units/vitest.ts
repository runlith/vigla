import * as vitest from 'vitest';
import { ruling, runsOn, type Manifest } from '../manifest.ts';
import { selects } from '../scope.ts';
import { suiteId, upstreamSkip, type Suite } from '../suites.ts';
import type { Target } from '../target.ts';

export * from 'vitest';

type Body = () => unknown;

interface Context {
	suite: Suite;
	manifest: Manifest;
	target: Target;
}

const path: string[] = [];
let governed: Context | null = null;

export const registered: string[] = [];

export function govern(
	suite: Suite,
	manifest: Manifest,
	target: Target,
	prefix: readonly string[] = []
): void {
	governed = { suite, manifest, target };
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
	const { suite, manifest, target } = governed;
	const id = suiteId(suite);
	if (!selects(id, key)) return;
	const rule = ruling(manifest, key);
	if (rule === undefined) {
		vitest.it(name, () => vitest.assert.fail(`${id}/${key} has no status in the manifest`));
	} else if (!runsOn(rule.status, suite.project, target.name)) {
		vitest.it.skip(name, body);
	} else if (skipped) {
		vitest.it.skip(name, { meta: upstreamSkip }, body);
	} else {
		vitest.it(name, body, timeout);
	}
}

export function it(name: string, body: Body, timeout?: number): void {
	register(name, body, false, timeout);
}

it.skip = (name: string, body: Body): void => register(name, body, true);

export const test = it;
