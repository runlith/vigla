import { CompileError as Fault, type Diagnostic } from 'vigla/compiler';
import { locator, type Locator } from '../front/index.ts';

export interface Location {
	line: number;
	column: number;
	character: number;
}

export interface Warning {
	code: string;
	message: string;
	filename?: string;
	start?: Location;
	end?: Location;
	position?: [number, number];
	frame?: string;
}

const unknownFilename = '(unknown)';
const leadingTabs = /^\t+/;

function tabsToSpaces(line: string): string {
	return line.replace(leadingTabs, (tabs) => '  '.repeat(tabs.length));
}

function codeFrame(lines: readonly string[], line: number, column: number): string {
	const first = Math.max(0, line - 2);
	const last = Math.min(line + 3, lines.length);
	const digits = String(last + 1).length;
	const out: string[] = [];
	for (let index = first; index < last; index++) {
		const text = lines[index] as string;
		const number = String(index + 1).padStart(digits, ' ');
		out.push(`${number}: ${tabsToSpaces(text)}`);
		if (index === line) {
			const indent = digits + 2 + tabsToSpaces(text.slice(0, column)).length;
			out.push(`${' '.repeat(indent)}^`);
		}
	}
	return out.join('\n');
}

function link(diagnostic: { code: string; message: string }): string {
	return `${diagnostic.message}\nhttps://svelte.dev/e/${diagnostic.code}`;
}

interface Located {
	readonly filename?: string;
	readonly position?: [number, number];
	readonly start?: Location;
	readonly end?: Location;
	readonly frame?: () => string;
}

function place(target: object, at: Located): void {
	const { frame, ...rest } = at;
	Object.assign(target, rest);
	if (frame === undefined) return;
	let text: string | undefined;
	Object.defineProperty(target, 'frame', {
		enumerable: true,
		configurable: true,
		get: () => (text ??= frame()),
		set: (value: string) => {
			text = value;
		}
	});
}

function described(code: string, message: string, at: Warning): string {
	let out = `${code}: ${message}`;
	if (at.filename !== undefined) {
		out += `\n${at.filename}`;
		if (at.start !== undefined) out += `:${at.start.line}:${at.start.column}`;
	}
	if (at.frame !== undefined) out += `\n${at.frame}`;
	return out;
}

export class CompileWarning implements Warning {
	readonly name = 'CompileWarning';
	code: string;
	message: string;
	declare filename?: string;
	declare position?: [number, number];
	declare start?: Location;
	declare end?: Location;
	declare frame?: string;

	constructor(code: string, message: string, at: Located) {
		this.code = code;
		this.message = message;
		place(this, at);
	}

	toString(): string {
		return described(this.code, this.message, this);
	}

	toJSON(): Warning {
		const { code, message, filename, start, end, position, frame } = this;
		return { code, message, filename, start, end, position, frame };
	}
}

export class CompileError extends Error {
	override message = '';
	code: string;
	declare filename?: string;
	declare position?: [number, number];
	declare start?: Location;
	declare end?: Location;
	declare frame?: string;

	constructor(code: string, message: string, at: Located) {
		super(message);
		this.stack = '';
		this.message = message;
		this.code = code;
		place(this, at);
		this.name = 'CompileError';
	}

	override toString(): string {
		return described(this.code, this.message, this);
	}

	toJSON(): Warning {
		const { code, message, filename, start, end, position, frame } = this;
		return { code, message, filename, start, end, position, frame };
	}
}

export interface Notice {
	readonly code: string;
	readonly message: string;
}

export interface Place {
	readonly filename?: string;
	readonly rootDir?: string;
}

function normalized(filename: string | undefined): string {
	return (filename ?? unknownFilename).replace(/\\/g, '/');
}

export function relativeFilename(place: Place): string {
	const filename = normalized(place.filename);
	const root = place.rootDir?.replace(/\\/g, '/');
	if (root === undefined || !filename.startsWith(root)) return filename;
	return filename.replace(root, '').replace(/^[/\\]/, '');
}

export class Diagnostics {
	readonly source: string;
	readonly #place: Place;
	readonly #filter: (warning: Warning) => boolean;
	#filename: string;
	#locate: Locator | undefined;
	#lines: string[] | undefined;

	constructor(source: string, place: Place, filter?: (warning: Warning) => boolean) {
		this.source = source;
		this.#place = place;
		this.#filter = filter ?? (() => true);
		this.#filename = normalized(place.filename);
	}

	analysing(): void {
		this.#filename = relativeFilename(this.#place);
	}

	get locate(): Locator {
		this.#locate ??= locator(this.source);
		return this.#locate;
	}

	located(start: number | undefined, end: number | undefined): Located {
		const filename = this.#filename === unknownFilename ? undefined : this.#filename;
		if (start === undefined) return filename === undefined ? {} : { filename };
		const finish = end ?? start;
		const from = this.locate(start);
		const to = this.locate(finish);
		this.#lines ??= this.source.split('\n');
		const lines = this.#lines;
		const frame = (): string => codeFrame(lines, from.line - 1, to.column);
		return {
			...(filename === undefined ? {} : { filename }),
			position: [start, finish],
			start: from,
			end: to,
			frame
		};
	}

	notices(notices: readonly Notice[]): Warning[] {
		return notices
			.map(
				(notice) =>
					new CompileWarning(notice.code, link(notice), this.located(undefined, undefined))
			)
			.filter(this.#filter);
	}

	warnings(diagnostics: readonly Diagnostic[]): Warning[] {
		const reshaped: Warning[] = [];
		for (const diagnostic of diagnostics) {
			const warning = new CompileWarning(
				diagnostic.code,
				link(diagnostic),
				this.located(diagnostic.start, diagnostic.end)
			);
			if (this.#filter(warning)) reshaped.push(warning);
		}
		return reshaped;
	}

	guard<T>(run: () => T): T {
		try {
			return run();
		} catch (error) {
			if (error instanceof Fault) {
				const { code, start, end } = error.diagnostic;
				const unplaced = code.startsWith('options_');
				const at = unplaced ? this.located(undefined, undefined) : this.located(start, end);
				throw new CompileError(code, link(error.diagnostic), at);
			}
			throw error;
		}
	}
}
