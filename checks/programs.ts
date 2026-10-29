import { defineProgram, type Finding, type Reading, type Side } from '@runlith/tagma/rules';
import type { InternalsParams } from './inspections.ts';

const specifier =
	/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)(['"`])([^'"`\n]+)\1/g;

async function internals(side: Side, params: InternalsParams): Promise<Reading> {
	const patterns = params.patterns.map((pattern) => new RegExp(pattern));
	const findings: Finding[] = [];
	for (const path of side.paths) {
		const text = await side.read(path);
		if (text === null) continue;
		const lines = text.split('\n');
		lines.forEach((line, index) => {
			for (const match of line.matchAll(specifier)) {
				const target = match[2] ?? '';
				if (!patterns.some((pattern) => pattern.test(target))) continue;
				findings.push({
					fingerprint: `${target} @ ${path}`,
					path,
					line: index + 1,
					message: `imports ${target}, an internal of the target`,
					fix: 'Reach the target through its public entries; only a target fresh-state hook in targets/<name> touches internals.'
				});
			}
		});
	}
	return { findings };
}

export default defineProgram<{ internals: InternalsParams }>({
	internals: async ({ params, tree, base }) =>
		base === null
			? { tree: await internals(tree, params) }
			: { tree: await internals(tree, params), base: await internals(base, params) }
});
