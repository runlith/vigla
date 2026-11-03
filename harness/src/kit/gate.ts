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

interface Task {
	name: string;
	suite?: Task;
	file?: Task & { filepath: string };
}

interface Context {
	task: Task & { file: { filepath: string } };
	skip(note?: string): void;
}

const [project = '', name = ''] = (process.env.VIGLA_TREE ?? '').split('/');
const tree = treeNamed(project, name);
const manifest = tree === undefined ? undefined : load(tree.project, tree.name);
const step = process.env.VIGLA_STEP ?? '';

function skipping(
	file: string,
	ancestors: readonly string[],
	title: string,
	variant: string
): { reason?: string } | null {
	if (tree?.runner !== 'kit' || manifest === undefined)
		throw new Error(`VIGLA_TREE names no Kit tree: ${process.env.VIGLA_TREE}`);
	const key = entryOfTree(tree, file, ancestors, title);
	if (key !== null && !selects(`${tree.project}/${tree.name}`, entryId(key, variant)))
		return { reason: 'not selected' };
	const rule = key === null ? undefined : ruling(manifest, key, variant);
	if (rule === undefined)
		throw new Error(
			`${tree.project}/${tree.name}/${key} (${variant}) has no status in the manifest`
		);
	if (runsOn(rule.status, tree.project, process.env.VIGLA_TARGET ?? '')) return null;
	return rule.reason === undefined ? {} : { reason: rule.reason };
}

export function gate(info: Info): void {
	const skip = skipping(
		info.file,
		info.titlePath.slice(1, -1),
		info.title,
		`${step}/${info.project.name}`
	);
	if (skip !== null) info.skip(true, skip.reason);
}

function ancestors(task: Task): string[] {
	const names: string[] = [];
	for (let at = task.suite; at !== undefined && at.file !== at; at = at.suite)
		names.unshift(at.name);
	return names;
}

export function gateTask(context: Context): void {
	const skip = skipping(
		context.task.file.filepath,
		ancestors(context.task),
		context.task.name,
		step
	);
	if (skip !== null) context.skip(skip.reason);
}
