import { CompileError as Fault, type Diagnostic } from 'dromon/compiler';
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
}

function link(diagnostic: { code: string; message: string }): string {
	return `${diagnostic.message}\nhttps://svelte.dev/e/${diagnostic.code}`;
}

export class CompileError extends Error {
	readonly code: string;
	readonly filename: string | undefined;
	readonly position: [number, number];
	readonly start: Location;
	readonly end: Location;

	constructor(diagnostic: Diagnostic, locate: Locator, filename: string | undefined) {
		super(link(diagnostic));
		this.name = 'CompileError';
		this.code = diagnostic.code;
		this.filename = filename;
		this.position = [diagnostic.start, diagnostic.end];
		this.start = locate(diagnostic.start);
		this.end = locate(diagnostic.end);
	}

	override toString(): string {
		const where =
			this.filename === undefined
				? ''
				: `${this.filename}:${this.start.line}:${this.start.column} `;
		return `${where}${this.message}`;
	}
}

export interface Notice {
	readonly code: string;
	readonly message: string;
}

export class Diagnostics {
	readonly source: string;
	readonly filename: string | undefined;
	readonly #filter: (warning: Warning) => boolean;
	#locate: Locator | undefined;

	constructor(
		source: string,
		filename: string | undefined,
		filter?: (warning: Warning) => boolean
	) {
		this.source = source;
		this.filename = filename;
		this.#filter = filter ?? (() => true);
	}

	get locate(): Locator {
		this.#locate ??= locator(this.source);
		return this.#locate;
	}

	notices(notices: readonly Notice[]): Warning[] {
		return notices
			.map((notice) => ({ code: notice.code, message: link(notice), filename: this.filename }))
			.filter(this.#filter);
	}

	warnings(diagnostics: readonly Diagnostic[]): Warning[] {
		const reshaped: Warning[] = [];
		for (const diagnostic of diagnostics) {
			const warning: Warning = {
				code: diagnostic.code,
				message: link(diagnostic),
				filename: this.filename,
				start: this.locate(diagnostic.start),
				end: this.locate(diagnostic.end),
				position: [diagnostic.start, diagnostic.end]
			};
			if (this.#filter(warning)) reshaped.push(warning);
		}
		return reshaped;
	}

	guard<T>(run: () => T): T {
		try {
			return run();
		} catch (error) {
			if (error instanceof Fault)
				throw new CompileError(error.diagnostic, this.locate, this.filename);
			throw error;
		}
	}
}
