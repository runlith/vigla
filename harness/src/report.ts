import { basename, dirname } from 'node:path';
import type { Reporter, TestModule, TestState, Vitest } from 'vitest/node';
import { load, ruling, statuses, type Manifest } from './manifest.ts';
import type { Variant } from './runtime/config.ts';
import { variants } from './runtime/variants.ts';

const title = /^(.*) \((dom|hydrate|ssr|async-ssr)\)$/;

const states: readonly TestState[] = ['passed', 'failed', 'skipped', 'pending'];

function manifestOf(module: TestModule): { name: string; manifest: Manifest } | null {
	const suite = basename(module.moduleId, '.test.ts');
	const project = basename(dirname(module.moduleId));
	try {
		return { name: `${project}/${suite}`, manifest: load(project, suite) };
	} catch {
		return null;
	}
}

export class Report implements Reporter {
	#log: (line: string) => void = (line) => console.log(line);

	onInit(vitest: Vitest): void {
		this.#log = (line) => vitest.logger.log(line);
	}

	onTestRunEnd(modules: ReadonlyArray<TestModule>): void {
		for (const module of modules) {
			const found = manifestOf(module);
			if (found === null) continue;
			const counts = new Map<string, number>();
			for (const test of module.children.allTests()) {
				const match = title.exec(test.name);
				if (match === null) continue;
				const sample = match[1] ?? '';
				const variant = match[2] as Variant;
				const status = ruling(found.manifest, sample, variant)?.status ?? 'unruled';
				const key = `${status} ${variant} ${test.result().state}`;
				counts.set(key, (counts.get(key) ?? 0) + 1);
			}
			this.#log(`\n${found.name}`);
			for (const status of [...statuses, 'unruled']) {
				for (const variant of variants) {
					const cells = states
						.map((state) => [state, counts.get(`${status} ${variant} ${state}`) ?? 0] as const)
						.filter(([, count]) => count > 0)
						.map(([state, count]) => `${count} ${state}`);
					if (cells.length > 0) this.#log(`  ${status} ${variant}: ${cells.join(', ')}`);
				}
			}
		}
	}
}
