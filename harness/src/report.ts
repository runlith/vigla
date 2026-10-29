import type { Reporter, TestModule, TestState, Vitest } from 'vitest/node';
import { load, ruling, statuses, type Manifest } from './manifest.ts';
import { variants } from './runtime/variants.ts';
import { entryOfTest, suiteOfFile, type Suite } from './suites.ts';

const states: readonly TestState[] = ['passed', 'failed', 'skipped', 'pending'];

const columns = [...variants, 'test'];

interface Tally {
	suite: Suite;
	manifest: Manifest;
	counts: Map<string, number>;
}

export class Report implements Reporter {
	#log: (line: string) => void = (line) => console.log(line);

	onInit(vitest: Vitest): void {
		this.#log = (line) => vitest.logger.log(line);
	}

	onTestRunEnd(modules: ReadonlyArray<TestModule>): void {
		const tallies = new Map<string, Tally>();
		for (const module of modules) {
			const suite = suiteOfFile(module.moduleId);
			if (suite === undefined) continue;
			let tally = tallies.get(suite.name);
			if (tally === undefined) {
				tally = { suite, manifest: load(suite.project, suite.name), counts: new Map() };
				tallies.set(suite.name, tally);
			}
			for (const test of module.children.allTests()) {
				if (test.name === 'manifest' && test.parent.type === 'module') continue;
				const entry =
					suite.kind === 'units' ? { sample: test.fullName } : entryOfTest(suite, [], test.name);
				if (entry === null) continue;
				const variant = 'variant' in entry ? entry.variant : undefined;
				const status = ruling(tally.manifest, entry.sample, variant)?.status ?? 'unruled';
				const key = `${status} ${variant ?? 'test'} ${test.result().state}`;
				tally.counts.set(key, (tally.counts.get(key) ?? 0) + 1);
			}
		}
		for (const { suite, counts } of tallies.values()) {
			this.#log(`\n${suite.project}/${suite.name}`);
			for (const status of [...statuses, 'unruled']) {
				for (const column of columns) {
					const cells = states
						.map((state) => [state, counts.get(`${status} ${column} ${state}`) ?? 0] as const)
						.filter(([, count]) => count > 0)
						.map(([state, count]) => `${count} ${state}`);
					if (cells.length > 0) this.#log(`  ${status} ${column}: ${cells.join(', ')}`);
				}
			}
		}
	}
}
