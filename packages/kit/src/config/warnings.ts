import { warnDiagnostic } from '../shared/diagnostics.ts';

interface KeyPath {
	keypath: string;
}
export function config_option_deprecated({ keypath }: KeyPath): void {
	warnDiagnostic(
		'config_option_deprecated',
		`The \`${keypath}\` option is deprecated, and will be removed in a future version`
	);
}
export function config_option_deprecated_alias({ keypath }: KeyPath): void {
	warnDiagnostic(
		'config_option_deprecated_alias',
		`The \`${keypath}\` option is deprecated, and will be removed in a future version of SvelteKit. Use subpath imports instead: https://svelte.dev/docs/kit/$lib`
	);
}
export function config_option_deprecated_typescript({ keypath }: KeyPath): void {
	warnDiagnostic(
		'config_option_deprecated_typescript',
		`The \`${keypath}\` option is deprecated, and will be removed in a future version. Add configuration to \`tsconfig.json\` directly`
	);
}
