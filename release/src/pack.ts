import {
	cpSync,
	existsSync,
	globSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { run } from './build.ts';
import { publishedManifest, targets, type Manifest } from './manifest.ts';

export interface Package {
	directory: string;
	manifest: Manifest;
}

export const test = /\.(test|spec)\.[cm]?[jt]sx?$/;

function read(file: string): Manifest {
	return JSON.parse(readFileSync(file, 'utf8')) as Manifest;
}

export function workspace(root: string): Package[] {
	const { workspaces = [] } = read(path.join(root, 'package.json')) as { workspaces?: string[] };
	return workspaces
		.flatMap((pattern) => globSync(`${pattern}/package.json`, { cwd: root }))
		.map((file) => ({
			directory: path.join(root, path.dirname(file)),
			manifest: read(path.join(root, file))
		}));
}

export function select(packages: Package[], names: string[]): Package[] {
	const published = packages.filter((item) => !item.manifest.private);
	if (names.length === 0) return published;
	return names.map((name) => {
		const found = published.find((item) => item.manifest.name === name);
		if (!found) throw new Error(`No publishable workspace package named ${name}`);
		return found;
	});
}

export function build(item: Package): void {
	if (!item.manifest.scripts?.build)
		throw new Error(`${item.manifest.name} declares no build script`);
	run('bun', ['run', 'build'], item.directory);
}

function missing(manifest: Manifest, directory: string): string[] {
	const bin = typeof manifest.bin === 'string' ? [manifest.bin] : Object.values(manifest.bin ?? {});
	const files = [
		...targets(manifest.exports),
		...targets(manifest.imports),
		...bin,
		...[manifest.main, manifest.module, manifest.types].filter((file) => file !== undefined)
	];
	return files.filter((file) => {
		const fixed = file.includes('*') ? path.dirname(file.slice(0, file.indexOf('*') + 1)) : file;
		return !existsSync(path.join(directory, fixed));
	});
}

export function stage(item: Package, versions: ReadonlyMap<string, string>): string {
	const { files } = item.manifest;
	if (!files) throw new Error(`${item.manifest.name} declares no files to publish`);
	const directory = mkdtempSync(path.join(tmpdir(), 'vigla-pack-'));
	for (const entry of files) {
		const from = path.join(item.directory, entry);
		if (!existsSync(from))
			throw new Error(`${item.manifest.name}: ${entry} is missing; was it built?`);
		cpSync(from, path.join(directory, entry), {
			recursive: true,
			filter: (file) => !test.test(file)
		});
	}
	const manifest = publishedManifest(item.manifest, versions);
	writeFileSync(path.join(directory, 'package.json'), JSON.stringify(manifest, null, '\t') + '\n');
	const absent = missing(manifest, directory);
	if (absent.length > 0)
		throw new Error(
			`${item.manifest.name} publishes targets it does not contain: ${absent.join(', ')}`
		);
	return directory;
}

export function tarball(manifest: Manifest): string {
	return `${manifest.name.replace(/^@/, '').replace('/', '-')}-${manifest.version}.tgz`;
}

export function pack(item: Package, versions: ReadonlyMap<string, string>, out: string): string {
	const directory = stage(item, versions);
	try {
		run('bun', ['pm', 'pack', '--quiet', '--destination', out], directory, false);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
	const file = path.join(out, tarball(item.manifest));
	if (!existsSync(file)) throw new Error(`bun pm pack wrote no ${file}`);
	return file;
}
