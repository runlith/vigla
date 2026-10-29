import { load, ruling, runs } from '../manifest.ts';
import { entryOfTree, treeNamed } from '../trees.ts';

interface Info {
	file: string;
	title: string;
	titlePath: readonly string[];
	project: { name: string };
	skip(condition: boolean, description?: string): void;
}

const tree = treeNamed('kit', process.env.DROMON_TREE ?? '');
const manifest = tree === undefined ? undefined : load(tree.project, tree.name);

export function gate(info: Info): void {
	if (tree === undefined || manifest === undefined)
		throw new Error(`DROMON_TREE names no Kit tree: ${process.env.DROMON_TREE}`);
	const key = entryOfTree(tree, info.file, info.titlePath.slice(1, -1), info.title);
	const variant = `${process.env.DROMON_STEP ?? ''}/${info.project.name}`;
	const rule = key === null ? undefined : ruling(manifest, key, variant);
	if (rule === undefined)
		throw new Error(`kit/${tree.name}/${key} (${variant}) has no status in the manifest`);
	if (!runs(rule.status)) info.skip(true, rule.reason);
}
