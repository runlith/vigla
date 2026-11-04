import type { Diagnostics } from '../shared/diagnostics.ts';

interface FileSuggestion {
	file: string;
	corrected: string;
}

export class SyncWarnings {
	private readonly d: Diagnostics;
	constructor(d: Diagnostics) {
		this.d = d;
	}
	route_file_prefix_missing({ file, corrected }: FileSuggestion): void {
		this.d.warn(
			'route_file_prefix_missing',
			`Missing route file prefix. Did you mean ${corrected}? at ${file}`
		);
	}
	file_name_misspelled({
		file,
		corrected,
		description
	}: FileSuggestion & { description: string }): void {
		this.d.warn('file_name_misspelled', `${description}. Did you mean ${corrected}? at ${file}`);
	}
}
