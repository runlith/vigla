import { existsSync, readFileSync } from 'node:fs';
import { preprocess, type PreprocessorGroup } from 'svelte/compiler';
import { expect } from 'vitest';
import type { Base } from '../runtime/config.ts';
import type { Plain } from '../samples.ts';

interface PreprocessConfig extends Base {
	options?: { filename: string };
	preprocess: PreprocessorGroup | PreprocessorGroup[];
	dependencies?: string[];
}

export const preprocessor: Plain<PreprocessConfig> = {
	run: async ({ cwd, config }) => {
		const input = readFileSync(`${cwd}/input.svelte`, 'utf8').replace(/\r\n/g, '\n');
		const result = await preprocess(
			input,
			config.preprocess || {},
			config.options || { filename: 'input.svelte' }
		);

		await expect(result.code).toMatchFileSnapshot(`${cwd}/output.svelte`);
		expect(result.dependencies).toEqual(config.dependencies || []);

		const expectedMap = `${cwd}/expected_map.json`;
		if (existsSync(expectedMap)) {
			const map = JSON.parse(JSON.stringify(result.map)) as Record<string, unknown>;
			delete map.ignoreList;
			expect(map).toEqual(JSON.parse(readFileSync(expectedMap, 'utf8')));
		}
	}
};
