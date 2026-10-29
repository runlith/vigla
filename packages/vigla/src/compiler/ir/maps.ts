import remapping, {
	type DecodedSourceMap,
	type EncodedSourceMap,
	type SourceMap,
	type SourceMapInput
} from '@jridgewell/remapping';

export type InputMap = string | EncodedSourceMap | DecodedSourceMap;

export interface OutputMap {
	sources: (string | null)[];
}

export function basename(path: string): string {
	return path.split(/[/\\]/).pop() as string;
}

export function relative(from: string, to: string): string {
	const base = from.split(/[/\\]/);
	const target = to.split(/[/\\]/);
	base.pop();
	while (base.length > 0 && target.length > 0 && base[0] === target[0]) {
		base.shift();
		target.shift();
	}
	return [...base.map(() => '..'), ...target].join('/');
}

export function sourceName(
	filename: string | null,
	outputFilename: string | null | undefined
): string | undefined {
	if (filename === null) return undefined;
	return outputFilename ? relative(outputFilename, filename) : basename(filename);
}

export function combine(file: string | null, maps: readonly SourceMapInput[]): SourceMap | null {
	if (maps.length === 0) return null;
	let next = 1;
	const sourced = (map: SourceMapInput) => (map as { sources: unknown[] }).sources.length === 1;
	const map = maps.slice(0, -1).every(sourced)
		? remapping(maps as SourceMapInput[], () => null, true)
		: remapping(
				maps[0] as SourceMapInput,
				(source) => (source === file && maps[next] ? maps[next++] : null),
				true
			);
	if (!map.file) delete map.file;
	if (map.sources.length === 0) map.sources = [file];
	return map;
}

export function chain(map: OutputMap, filename: string | null, input: InputMap): void {
	const own = map.sources[0] ?? null;
	const file = filename === null ? null : basename(filename);
	const parsed = (typeof input === 'string' ? JSON.parse(input) : input) as EncodedSourceMap;
	const preceding =
		parsed.sources.length === 1 && !parsed.sources[0] ? { ...parsed, sources: [file] } : parsed;
	map.sources = [file];
	Object.assign(map, combine(file, [map as SourceMapInput, preceding]));
	if (own !== null && file !== own) {
		map.sources = map.sources.map((source) => (source === null ? null : relative(own, source)));
	}
}
