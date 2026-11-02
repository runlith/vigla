import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { faults, load, ruling, runsOn } from '../manifest.ts';
import { modeOf, outcomes, readRuns, writeRuns } from '../reports.ts';
import { samplesOf, treeNamed } from '../trees.ts';
import { plan } from './steps.ts';
import { reportName, selected, units, type Unit } from './units.ts';

test('own app selection and reports preserve the sample project and variant', () => {
	const work = mkdtempSync(join(tmpdir(), 'harness-kit-'));
	try {
		const tree = treeNamed('own', 'kit');
		assert.ok(tree);
		cpSync(samplesOf(tree), join(work, tree.source), { recursive: true });
		const [unit] = selected(units(work, 'own'), ['own/kit/layout-data']);
		assert.ok(unit);
		const dir = join(work, unit.dir);
		const [step] = plan(dir, unit.scripts);
		assert.ok(step?.label);
		const file = reportName(unit, step.label);
		writeRuns(work, [{ tree: unit.tree, mode: step.label, file, env: {} }]);
		writeFileSync(
			join(work, file),
			JSON.stringify({
				config: { rootDir: join(dir, 'test') },
				suites: [
					{
						title: 'hydration.test.js',
						specs: [
							{
								file: 'hydration.test.js',
								title: 'grouped server data survives initial hydration',
								tests: [
									{ projectName: 'chromium-dev', status: 'expected', expectedStatus: 'passed' }
								]
							}
						]
					}
				]
			})
		);
		const [run] = readRuns(work) ?? [];
		assert.ok(run);
		assert.equal(run.tree.project, 'own');
		assert.equal(modeOf(run.tree, run.file), run.mode);
		const [result] = outcomes(run.tree, join(work, run.file), run.mode) ?? [];
		assert.ok(result);
		assert.deepEqual(result, {
			key: 'layout-data/test/hydration.test.js > grouped server data survives initial hydration',
			state: 'passed',
			variant: 'test-dev-1/chromium-dev'
		});
		const manifest = load(run.tree.project, run.tree.name);
		assert.deepEqual(faults(manifest), []);
		const rule = ruling(manifest, result.key, result.variant);
		assert.ok(rule && runsOn(rule.status, run.tree.project, 'vigla'));
	} finally {
		rmSync(work, { recursive: true, force: true });
	}
});

test('copied app short selectors and report names remain separate from own apps', () => {
	const copied = treeNamed('kit', 'apps');
	const own = treeNamed('own', 'kit');
	assert.ok(copied && own);
	const app: Unit = { tree: copied, app: 'layout-data', dir: '', scripts: [] };
	const regression: Unit = { ...app, tree: own };
	assert.deepEqual(selected([app, regression], ['apps/layout-data']), [app]);
	assert.deepEqual(selected([app, regression], ['own/kit/layout-data']), [regression]);
	assert.equal(reportName(app, 'test-dev-1'), 'apps.layout-data.test-dev-1.json');
	assert.equal(reportName(regression, 'test-dev-1'), 'own.kit.layout-data.test-dev-1.json');
});
