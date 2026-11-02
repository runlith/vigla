import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { root } from '../manifest.ts';
import { execute, plan } from './steps.ts';
import { checkTypes } from './types.ts';
import { reportName, selected, units } from './units.ts';

const [copy, out, ...names] = process.argv.slice(2);
if (copy === undefined || out === undefined) {
	console.error('usage: reference.ts <kit copy> <report dir> [tree | tree/app ...]');
	process.exit(2);
}
const kit = resolve(copy);
const reports = resolve(out);
mkdirSync(reports, { recursive: true });
const pnpm = join(root, '..', 'targets', 'upstream', 'kit', 'node_modules', '.bin');

for (const unit of selected(units(kit), names)) {
	const dir = join(kit, unit.dir);
	if (unit.tree.name === 'types') {
		const tsc = ['node_modules/@typescript/native/bin/tsc', '--pretty', 'false', '--project'];
		const cwd = join(kit, 'packages', 'kit');
		checkTypes(
			dir,
			[
				{ cwd, command: 'node', args: [...tsc, 'test/types/tsconfig.json'] },
				{ cwd, command: 'node', args: [...tsc, 'test/types/app-error-enhanced/tsconfig.json'] }
			],
			join(reports, reportName(unit, 'check-1'))
		);
		continue;
	}
	for (const step of plan(dir, unit.scripts)) {
		console.log(`\n${unit.tree.name}/${unit.app} ${step.label ?? step.command}`);
		execute(step, {
			cwd: dir,
			path: [
				join(dir, 'node_modules', '.bin'),
				join(kit, 'node_modules', '.bin'),
				dirname(join(pnpm, 'pnpm'))
			],
			env: { NODE_OPTIONS: `--import=${join(root, 'src', 'force.ts')}`, KIT_E2E_RETRIES: '2' },
			report: (label) => join(reports, reportName(unit, label))
		});
	}
}
