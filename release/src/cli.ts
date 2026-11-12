import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { bundle, emit, run } from './build.ts';
import { ordered } from './order.ts';
import { build, pack, select, workspace } from './pack.ts';
import { answered, held, publish } from './publish.ts';
import { changed, changedSince, lastRelease, plan, write } from './raise.ts';

const root = path.resolve(import.meta.dirname, '../..');
const { positionals, values } = parseArgs({
	allowPositionals: true,
	options: {
		out: { type: 'string', default: path.join(root, '.work/pack') },
		since: { type: 'string' },
		minor: { type: 'string', multiple: true, default: [] },
		'dry-run': { type: 'boolean', default: false }
	}
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
	case 'raise': {
		const packages = select(workspace(root), []);
		const base = values.since ?? lastRelease(root);
		const versions = plan(
			packages,
			changed(packages, root, changedSince(root, base)),
			new Set(values.minor)
		);
		if (versions.size === 0) {
			console.log(`nothing published changed since ${base}`);
			break;
		}
		for (const item of packages) {
			const version = versions.get(item.manifest.name);
			if (version === undefined) continue;
			write(item, version);
			console.log(`${item.manifest.name} ${item.manifest.version} → ${version}`);
		}
		run('bun', ['install'], root);
		break;
	}
	case 'publish': {
		const packages = workspace(root);
		const versions = new Map(packages.map((item) => [item.manifest.name, item.manifest.version]));
		const pending = ordered(select(packages, [])).filter((item) => !held(item.manifest));
		if (pending.length === 0) {
			console.log('the registry holds every version');
			break;
		}
		const out = path.resolve(values.out);
		mkdirSync(out, { recursive: true });
		for (const item of pending) build(item);
		const files = pending.map((item) => pack(item, versions, out));
		for (const file of files) publish(file, true);
		if (values['dry-run']) break;
		for (const file of files) publish(file, false);
		await answered(pending.map((item) => item.manifest));
		for (const item of pending) console.log(`${item.manifest.name}@${item.manifest.version}`);
		break;
	}
	default:
		throw new Error(
			'usage: node release/src/cli.ts emit | bundle <input> <output> | build [name…] | pack [--out dir] [name…] | raise [--since commit] [--minor name]… | publish [--out dir] [--dry-run]'
		);
}
