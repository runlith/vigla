import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { bundle, emit } from './build.ts';
import { build, pack, select, workspace } from './pack.ts';

const root = path.resolve(import.meta.dirname, '../..');
const { positionals, values } = parseArgs({
	allowPositionals: true,
	options: { out: { type: 'string', default: path.join(root, '.work/pack') } }
});
const [command, ...args] = positionals;

switch (command) {
	case 'emit':
		emit(process.cwd());
		break;
	case 'bundle': {
		const [input, output] = args;
		if (!input || !output) throw new Error('usage: bundle <input> <output>');
		await bundle(process.cwd(), input, output);
		break;
	}
	case 'build':
		for (const item of select(workspace(root), args)) build(item);
		break;
	case 'pack': {
		const packages = workspace(root);
		const versions = new Map(packages.map((item) => [item.manifest.name, item.manifest.version]));
		const out = path.resolve(values.out);
		mkdirSync(out, { recursive: true });
		const selected = select(packages, args);
		for (const item of selected) build(item);
		for (const item of selected) console.log(pack(item, versions, out));
		break;
	}
	default:
		throw new Error(
			'usage: node release/src/cli.ts emit | bundle <input> <output> | build [name…] | pack [--out dir] [name…]'
		);
}
