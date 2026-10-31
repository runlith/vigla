import { throwDiagnostic, warnDiagnostic } from '../shared/diagnostics.ts';

interface InstrumentationMessage {
	kind: string;
	file: string;
}
interface FileMessage {
	file: string;
}
export function adapter_generate_manifest_removed(): never {
	throwDiagnostic(
		'adapter_generate_manifest_removed',
		'`builder.generateManifest` has been removed. Use `builder.generateServerInstance` instead.',
		adapter_generate_manifest_removed
	);
}
export function adapter_instrumentation_file_missing({
	kind,
	file
}: InstrumentationMessage): never {
	throwDiagnostic(
		'adapter_instrumentation_file_missing',
		`${kind} not found at \`${file}\``,
		adapter_instrumentation_file_missing
	);
}
export function adapter_fallback_overwrites({ file }: FileMessage): void {
	warnDiagnostic(
		'adapter_fallback_overwrites',
		`Overwriting \`${file}\` with fallback page. Consider using a different name for the fallback.`
	);
}
export function prerender_fallback_failed(): never {
	throwDiagnostic(
		'prerender_fallback_failed',
		'Could not generate a fallback page',
		prerender_fallback_failed
	);
}
