import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	realpathSync,
	statSync,
	writeFileSync
} from 'node:fs';
import { dirname, join, relative } from 'node:path';

export function posix(file: string): string {
	return file.replaceAll('\\', '/');
}
export function relativeFile(root: string, file: string): string {
	return posix(relative(root, file));
}
export function importPath(from: string, file: string): string {
	const path = relativeFile(from, file).replace(/\.(?:ts|mts|cts)$/, '.js');
	return path.startsWith('.') ? path : './' + path;
}
export function resolveEntry(file: string, extensions: readonly string[]): string | null {
	const candidates = [
		file,
		...extensions.map((extension) => join(file, 'index' + extension)),
		...extensions.map((extension) => file + extension)
	];
	return (
		candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? null
	);
}
export function writeChanged(file: string, text: string): void {
	if (existsSync(file) && readFileSync(file, 'utf8') === text) return;
	mkdirSync(dirname(file), { recursive: true });
	writeFileSync(file, text);
}
export function filesUnder(root: string): string[] {
	if (!existsSync(root)) return [];
	const files: string[] = [];
	const walk = (directory: string, ancestors: Set<string>): void => {
		const real = realpathSync(directory);
		if (ancestors.has(real)) return;
		const branch = new Set(ancestors).add(real);
		for (const entry of readdirSync(directory).sort()) {
			const file = join(directory, entry);
			if (statSync(file).isDirectory()) walk(file, branch);
			else files.push(file);
		}
	};
	walk(root, new Set());
	return files;
}
