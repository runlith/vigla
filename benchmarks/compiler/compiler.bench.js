import { compile, parse } from 'svelte/compiler';
import { fastest } from '../shared/time.js';
import { sources } from './sources.js';

const options = { generate: 'client', runes: true, experimental: { async: true } };

function measure(label, iterations, run) {
	return {
		label,
		fn: async () => {
			for (let i = 0; i < iterations; i++) run();
			return fastest(10, () => {
				for (let i = 0; i < iterations; i++) run();
			});
		}
	};
}

export default [
	...sources.map(({ name, source, iterations }) =>
		measure(`parser_${name}`, iterations, () => parse(source, { modern: true }))
	),
	...sources.map(({ name, source, iterations }) =>
		measure(`compile_${name}`, iterations, () => compile(source, options))
	)
];
