import { defineProgram, type Finding, type Reading, type Side } from '@runlith/tagma/rules';
import type { InternalsParams } from './inspections.ts';

const specifier = /(?:\bfrom|\bimport\s*\(|\bimport|\brequire\s*\()\s*(['"`])([^'"`]+)\1/g;

function blank(text: string): string {
	return text.replace(/[^\n]/g, ' ');
}

function code(text: string): string {
	let out = '';
	let index = 0;
	while (index < text.length) {
		const char = text[index] ?? '';
		const next = text[index + 1];
		if (char === '/' && next === '/') {
			const end = text.indexOf('\n', index);
			const stop = end === -1 ? text.length : end;
			out += blank(text.slice(index, stop));
			index = stop;
		} else if (char === '/' && next === '*') {
			const end = text.indexOf('*/', index + 2);
			const stop = end === -1 ? text.length : end + 2;
			out += blank(text.slice(index, stop));
			index = stop;
		} else if (char === '"' || char === "'" || char === '`') {
			let stop = index + 1;
			while (stop < text.length && text[stop] !== char) stop += text[stop] === '\\' ? 2 : 1;
			out += text.slice(index, stop + 1);
			index = stop + 1;
		} else {
			out += char;
			index += 1;
		}
	}
	return out;
}

function lineOf(text: string, offset: number): number {
	let line = 1;
	for (let index = 0; index < offset; index++) if (text[index] === '\n') line += 1;
	return line;
}

async function internals(side: Side, params: InternalsParams): Promise<Reading> {
	const patterns = params.patterns.map((pattern) => new RegExp(pattern));
	const findings: Finding[] = [];
	for (const path of side.paths) {
		const text = await side.read(path);
		if (text === null) continue;
		const source = code(text);
		for (const match of source.matchAll(specifier)) {
			const target = match[2] ?? '';
			if (!patterns.some((pattern) => pattern.test(target))) continue;
			findings.push({
				fingerprint: `${target} @ ${path}`,
				path,
				line: lineOf(source, match.index + match[0].length - target.length - 1),
				message: `imports ${target}, an internal of the target`,
				fix: 'Reach the target through its public entries; only a target fresh-state hook in targets/<name> touches internals.'
			});
		}
	}
	return { findings };
}

export default defineProgram<{ internals: InternalsParams }>({
	internals: async ({ params, tree, base }) =>
		base === null
			? { tree: await internals(tree, params) }
			: { tree: await internals(tree, params), base: await internals(base, params) }
});
