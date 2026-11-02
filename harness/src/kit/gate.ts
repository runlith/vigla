import { load, ruling, runsOn } from '../manifest.ts';
import { selects } from '../scope.ts';
import { entryId } from '../suites.ts';
import { entryOfTree, treeNamed } from '../trees.ts';

interface Info {
	file: string;
	title: string;
	titlePath: readonly string[];
	project: { name: string };
	skip(condition: boolean, description?: string): void;
}

const [project = '', name = ''] = (process.env.VIGLA_TREE ?? '').split('/');
const tree = treeNamed(project, name);
const manifest = tree === undefined ? undefined : load(tree.project, tree.name);

export function gate(info: Info): void {
	if (tree?.runner !== 'kit' || manifest === undefined)
		throw new Error(`VIGLA_TREE names no Kit tree: ${process.env.VIGLA_TREE}`);
	const key = entryOfTree(tree, info.file, info.titlePath.slice(1, -1), info.title);
	const variant = `${process.env.VIGLA_STEP ?? ''}/${info.project.name}`;
	if (key !== null && !selects(`${tree.project}/${tree.name}`, entryId(key, variant)))
		return info.skip(true, 'not selected');
	const rule = key === null ? undefined : ruling(manifest, key, variant);
	if (rule === undefined)
		throw new Error(
			`${tree.project}/${tree.name}/${key} (${variant}) has no status in the manifest`
		);
	if (!runsOn(rule.status, tree.project, process.env.VIGLA_TARGET ?? ''))
		info.skip(true, rule.reason);
}
