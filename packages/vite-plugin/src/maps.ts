import path from 'node:path';
import process from 'node:process';

const windows = process.platform === 'win32';

export interface FileRefs {
	file?: string;
	sources?: (string | null)[];
	sourceRoot?: string;
}

export function mapToRelative(map: FileRefs | null | undefined, filename: string): void {
	if (!map) return;
	const root = map.sourceRoot;
	const dirname = path.dirname(filename);
	const relative = (source: string | null): string | null => {
		if (!source) return source;
		let full: string;
		if (source.startsWith('file:///')) full = source.slice(windows ? 8 : 7);
		else if (root)
			full = `${root}${root.endsWith('/') || source.startsWith('/') ? '' : '/'}${source}`;
		else full = source;
		return path.isAbsolute(full) ? path.relative(dirname, full) : full;
	};
	if (map.file) map.file = path.basename(filename);
	if (map.sources) map.sources = map.sources.map(relative);
	if (map.sourceRoot) delete map.sourceRoot;
}

export function removeLangSuffix(map: FileRefs | null | undefined, suffix: string): void {
	if (!map) return;
	const strip = (source: string | null) =>
		source?.endsWith(suffix) ? source.slice(0, -suffix.length) : source;
	if (map.file) map.file = strip(map.file) ?? undefined;
	if (map.sources) map.sources = map.sources.map(strip);
}
