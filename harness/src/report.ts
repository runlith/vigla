import { relative } from 'node:path';
import type { Reporter, TestModule, Vitest } from 'vitest/node';

export default class Progress implements Reporter {
	#log: (line: string) => void = (line) => console.log(line);
	#root = process.cwd();

	onInit(vitest: Vitest): void {
		this.#log = (line) => vitest.logger.log(line);
		this.#root = vitest.config.root;
	}

	onTestModuleEnd(module: TestModule): void {
		const counts = new Map<string, number>();
		for (const test of module.children.allTests()) {
			const state = test.result().state;
			counts.set(state, (counts.get(state) ?? 0) + 1);
		}
		const cells = [...counts].map(([state, count]) => `${count} ${state}`);
		const failed = module.errors().length > 0 ? ' (failed to load)' : '';
		this.#log(
			`${relative(this.#root, module.moduleId)}${failed}: ${cells.join(', ') || 'no tests'}`
		);
	}
}
