import remapping, { type DecodedSourceMap, type SourceMapSegment } from '@jridgewell/remapping';

export type Map = DecodedSourceMap;
export type Segment = number[];

export interface Point {
	line: number;
	column: number;
}

export interface Source {
	source: string;
	locate: (offset: number) => Point;
	basename: string | null;
	filename: string | undefined;
}

export function slice(code: string, offset: number, source: Source): Source {
	return {
		source: code,
		locate: (index) => source.locate(index + offset),
		basename: source.basename,
		filename: source.filename
	};
}

export function addOffset(map: Map, offset: Point, sourceIndex: number): void {
	for (const line of map.mappings) {
		for (const segment of line as unknown as Segment[]) {
			if (segment[1] !== sourceIndex) continue;
			if (segment[2] === 0) (segment[3] as number) += offset.column;
			(segment[2] as number) += offset.line;
		}
	}
}

function merge<T>(
	own: readonly T[],
	other: readonly T[] | undefined
): [T[], number[], boolean, boolean] {
	const table = own.slice();
	const indices: number[] = [];
	let changed = false;
	(other ?? []).forEach((value, index) => {
		const existing = own.indexOf(value);
		if (existing >= 0) {
			indices[index] = existing;
		} else {
			indices[index] = table.length;
			table.push(value);
			changed = true;
		}
	});
	const moved = changed && indices.some((value, index) => value !== index);
	return [table, indices, changed, moved];
}

const lineToken = /([^\w\s]|\s+)/g;

function emptyMap(): Map {
	return { version: 3, mappings: [], sources: [], names: [] } as unknown as Map;
}

export class MappedCode {
	string: string;
	map: Map;

	constructor(string = '', map: Map | null = null) {
		this.string = string;
		this.map = map ?? emptyMap();
	}

	concat(other: MappedCode): MappedCode {
		if (other.string === '') return this;
		if (this.string === '') {
			this.string = other.string;
			this.map = other.map;
			return this;
		}
		const columnOffset = this.string.length - this.string.lastIndexOf('\n') - 1;
		this.string += other.string;
		const own = this.map;
		const theirs = other.map;
		if (theirs.mappings.length === 0) return this;
		const [sources, sourceIndices, sourcesChanged, sourcesMoved] = merge(
			own.sources,
			theirs.sources
		);
		const [names, nameIndices, namesChanged, namesMoved] = merge(own.names, theirs.names);
		if (sourcesChanged) own.sources = sources;
		if (namesChanged) own.names = names;
		if (sourcesMoved || namesMoved) {
			for (const line of theirs.mappings) {
				for (const segment of line as unknown as Segment[]) {
					if (sourcesMoved && (segment[1] as number) >= 0)
						segment[1] = sourceIndices[segment[1] as number] as number;
					if (namesMoved && (segment[4] as number) >= 0)
						segment[4] = nameIndices[segment[4] as number] as number;
				}
			}
		}
		const mappings = theirs.mappings as unknown as Segment[][];
		if (columnOffset > 0) {
			for (const segment of mappings[0] as Segment[]) (segment[0] as number) += columnOffset;
		}
		const ownMappings = own.mappings as unknown as Segment[][];
		const lastLine = ownMappings[ownMappings.length - 1] as Segment[];
		for (const segment of mappings.shift() as Segment[]) lastLine.push(segment);
		for (const line of mappings) ownMappings.push(line);
		return this;
	}

	static processed(string: string, map?: Map): MappedCode {
		const lines = string.split('\n').length;
		if (map) {
			for (let missing = lines - map.mappings.length; missing > 0; missing--) map.mappings.push([]);
			return new MappedCode(string, map);
		}
		if (string === '') return new MappedCode();
		const fresh = emptyMap();
		for (let index = 0; index < lines; index++) fresh.mappings.push([]);
		return new MappedCode(string, fresh);
	}

	static source({ source, basename, locate }: Source): MappedCode {
		const offset = locate(0) ?? { line: 0, column: 0 };
		const map = { version: 3, names: [], sources: [basename], mappings: [] } as unknown as Map;
		if (source === '') return new MappedCode(source, map);
		const lines = source.split('\n');
		const mappings = map.mappings as unknown as Segment[][];
		lines.forEach((text, line) => {
			const segments: Segment[] = [];
			mappings.push(segments);
			let column = 0;
			for (const token of text.split(lineToken)) {
				if (token === '') continue;
				segments.push([column, 0, offset.line + line, column]);
				column += token.length;
			}
		});
		for (const segment of mappings[0] as Segment[]) (segment[3] as number) += offset.column;
		return new MappedCode(source, map);
	}
}

export function combine(basename: string | null, maps: Map[]): Map | null {
	if (maps.length === 0) return null;
	let next = 1;
	const singleSourced = maps.slice(0, -1).every((map) => map.sources.length === 1);
	const map = (singleSourced
		? remapping(maps as never, () => null, true)
		: remapping(
				maps[0] as never,
				(file) => (file === basename && maps[next] ? (maps[next++] as never) : null),
				true
			)) as unknown as Map & { file?: string };
	if (!map.file) delete map.file;
	if (!map.sources.length) map.sources = [basename];
	return map;
}

export function basenameOf(filename: string): string {
	return filename.split(/[/\\]/).pop() as string;
}

export type { SourceMapSegment };
