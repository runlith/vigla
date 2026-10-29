import { decode } from '@jridgewell/sourcemap-codec';
import type { Map, Segment } from './mapped.ts';

interface GeneratorMapping {
	generatedLine: number;
	generatedColumn: number;
	originalLine: number;
	originalColumn: number;
	source: string | null;
	name: string | null;
}

interface Generator {
	_version: number;
	_file?: string | null;
	_sources: { toArray(): string[] };
	_names: { toArray(): string[] };
	_mappings: { toArray(): GeneratorMapping[] };
}

function indexOf(values: readonly string[]): Record<string, number> {
	const index: Record<string, number> = {};
	values.forEach((value, position) => {
		index[value] = position;
	});
	return index;
}

function same(a: GeneratorMapping, b: GeneratorMapping): boolean {
	return (
		a.generatedColumn === b.generatedColumn &&
		a.originalColumn === b.originalColumn &&
		a.name === b.name &&
		a.generatedLine === b.generatedLine &&
		a.originalLine === b.originalLine &&
		a.source === b.source
	);
}

function fromGenerator(generator: Generator): Map {
	const sources = generator._sources.toArray();
	const names = generator._names.toArray();
	const sourceIndex = indexOf(sources);
	const nameIndex = indexOf(names);
	const mappings = generator._mappings.toArray();
	const lines: Segment[][] = [[]];
	let line = 1;
	let current = lines[0] as Segment[];
	mappings.forEach((mapping, index) => {
		if (mapping.generatedLine > line) {
			while (mapping.generatedLine > line) {
				lines.push([]);
				line++;
			}
			current = lines[mapping.generatedLine - 1] as Segment[];
		} else if (index > 0 && same(mapping, mappings[index - 1] as GeneratorMapping)) {
			return;
		}
		const segment: Segment = [mapping.generatedColumn];
		if (mapping.source != null) {
			segment.push(
				sourceIndex[mapping.source] as number,
				mapping.originalLine - 1,
				mapping.originalColumn
			);
			if (mapping.name != null) segment.push(nameIndex[mapping.name] as number);
		}
		current.push(segment);
	});
	const map = { version: generator._version, sources, names, mappings: lines } as unknown as Map & {
		file?: string;
	};
	if (generator._file != null) map.file = generator._file;
	return map;
}

export function decodeMap(raw: string | object): Map {
	let map = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Map & { mappings: unknown };
	if (typeof map.mappings === 'string') map.mappings = decode(map.mappings) as never;
	const generator = map as unknown as Generator & { constructor: { name: string } };
	if (generator._mappings && generator.constructor.name === 'SourceMapGenerator') {
		map = fromGenerator(generator);
	}
	return map;
}
