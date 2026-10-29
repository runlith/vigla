import { load, ruling, runs } from './manifest.ts';
import { selects } from './scope.ts';
import { entryId } from './suites.ts';
import { entryOfTree, treeNamed } from './trees.ts';

interface Task {
	name: string;
	suite?: Task;
	file?: Task & { filepath: string };
}

interface Context {
	task: Task & { file: { filepath: string } };
	skip(note?: string): void;
}

type Hook = (body: (context: Context) => void) => void;

const [project = '', name = ''] = (process.env.VIGLA_TREE ?? '').split('/');
const tree = treeNamed(project, name);
if (tree === undefined) throw new Error(`VIGLA_TREE names no tree: ${process.env.VIGLA_TREE}`);
const manifest = load(tree.project, tree.name);
const mode = process.env.VIGLA_MODE || undefined;

function ancestors(task: Task): string[] {
	const names: string[] = [];
	for (let at = task.suite; at !== undefined && at.file !== at; at = at.suite)
		names.unshift(at.name);
	return names;
}

(globalThis as unknown as { beforeEach: Hook }).beforeEach((context) => {
	const key = entryOfTree(
		tree,
		context.task.file.filepath,
		ancestors(context.task),
		context.task.name
	);
	const rule = key === null ? undefined : ruling(manifest, key, mode);
	if (key !== null && !selects(`${tree.project}/${tree.name}`, entryId(key, mode)))
		return context.skip('not selected');
	if (rule === undefined)
		throw new Error(`${tree.project}/${tree.name}/${key} has no status in the manifest`);
	if (!runs(rule.status)) context.skip(rule.reason);
});
