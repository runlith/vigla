import { warnDiagnostic } from '../shared/diagnostics.ts';

interface FileSuggestion {
	file: string;
	corrected: string;
}
export function route_file_prefix_missing({ file, corrected }: FileSuggestion): void {
	warnDiagnostic(
		'route_file_prefix_missing',
		`Missing route file prefix. Did you mean ${corrected}? at ${file}`
	);
}
export function file_name_misspelled({
	file,
	corrected,
	description
}: FileSuggestion & { description: string }): void {
	warnDiagnostic('file_name_misspelled', `${description}. Did you mean ${corrected}? at ${file}`);
}
