import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync
} from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { brotliCompress, gzip, constants } from 'node:zlib';
import type { CopyOptions } from '../types/builder.ts';

export function posix(file: string): string {
	return file.replaceAll('\\', '/');
}
export function specifier(from: string, to: string): string {
	const relative = posix(path.relative(from, to));
	return relative.startsWith('./') || relative.startsWith('../') ? relative : './' + relative;
}
export function write(file: string, source: string | Uint8Array): void {
	mkdirSync(path.dirname(file), { recursive: true });
	writeFileSync(file, source);
}
export function walk(directory: string): string[] {
	if (!existsSync(directory)) return [];
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const file = path.join(directory, entry.name);
		return entry.isDirectory()
			? walk(file).map((child) => posix(path.join(entry.name, child)))
			: [entry.name];
	});
}
export function copy(source: string, destination: string, options: CopyOptions = {}): string[] {
	if (!existsSync(source)) return [];
	const files: string[] = [];
	function visit(from: string, to: string, relative: string): void {
		if (options.filter && !options.filter(path.basename(from))) return;
		if (statSync(from).isDirectory()) {
			mkdirSync(to, { recursive: true });
			for (const name of readdirSync(from))
				visit(path.join(from, name), path.join(to, name), path.join(relative, name));
			return;
		}
		mkdirSync(path.dirname(to), { recursive: true });
		if (options.replace) {
			let content = readFileSync(from, 'utf8');
			for (const [key, value] of Object.entries(options.replace))
				content = content.replaceAll(key, value);
			writeFileSync(to, content);
		} else copyFileSync(from, to);
		files.push(posix(relative || path.basename(from)));
	}
	visit(source, destination, '');
	return files;
}
export function remove(directory: string): void {
	rmSync(directory, { force: true, recursive: true });
}

const gzipAsync = promisify(gzip);
const brotliAsync = promisify(brotliCompress);
const compressible = new Set([
	'.html',
	'.js',
	'.mjs',
	'.json',
	'.css',
	'.svg',
	'.xml',
	'.wasm',
	'.txt',
	'.md',
	'.mdx'
]);

export async function compress(directory: string): Promise<string[]> {
	const files = walk(directory).filter((file) => compressible.has(path.extname(file)));
	let next = 0;
	await Promise.all(
		Array.from({ length: Math.min(16, files.length) }, async () => {
			while (next < files.length) {
				const file = path.join(directory, files[next++]!);
				const contents = readFileSync(file);
				const [gz, br] = await Promise.all([
					gzipAsync(contents, { level: constants.Z_BEST_COMPRESSION }),
					brotliAsync(contents)
				]);
				writeFileSync(file + '.gz', gz);
				writeFileSync(file + '.br', br);
			}
		})
	);
	return files;
}
