import type { Diagnostic } from 'vigla/compiler';
import { warning, warningCodes } from './diagnostics.ts';
import { closest } from './fuzzy.ts';

const runtimeCodes = [
	'await_waterfall',
	'await_reactivity_loss',
	'state_snapshot_uncloneable',
	'binding_property_non_reactive',
	'hydration_attribute_changed',
	'hydration_html_changed',
	'ownership_invalid_binding',
	'ownership_invalid_mutation'
];

export const ignorableCodes: ReadonlySet<string> = new Set([...warningCodes, ...runtimeCodes]);

export const legacyCodes: Readonly<Record<string, string>> = {
	'non-top-level-reactive-declaration': 'reactive_declaration_invalid_placement',
	'module-script-reactive-declaration': 'reactive_declaration_module_script',
	'empty-block': 'block_empty',
	'avoid-is': 'attribute_avoid_is',
	'invalid-html-attribute': 'attribute_invalid_property_name',
	'a11y-structure': 'a11y_figcaption_parent',
	'illegal-attribute-character': 'attribute_illegal_colon',
	'invalid-rest-eachblock-binding': 'bind_invalid_each_rest',
	'unused-export-let': 'export_let_unused'
};

export const ignorePrefix = /^\s*svelte-ignore\s/;

export function replacement(code: string): string {
	return legacyCodes[code] ?? code.replace(/-/g, '_');
}

export interface Extracted {
	readonly codes: string[];
	readonly warnings: Diagnostic[];
}

const runesCodes = /([\w$-]+)(,)?/gm;

export function extractIgnores(offset: number, text: string): Extracted {
	const match = ignorePrefix.exec(text);
	const codes: string[] = [];
	const warnings: Diagnostic[] = [];
	if (match === null) return { codes, warnings };
	const length = match[0].length;
	const from = offset + length;
	for (const found of text.slice(length).matchAll(runesCodes)) {
		const code = found[1] as string;
		if (ignorableCodes.has(code)) {
			codes.push(code);
		} else {
			const start = from + found.index;
			const at = { start, end: start + code.length };
			const replaced = replacement(code);
			if (ignorableCodes.has(replaced)) {
				warnings.push(warning('legacy_code', at, { code, suggestion: replaced }));
			} else {
				warnings.push(
					warning('unknown_code', at, { code, suggestion: closest(code, [...ignorableCodes]) })
				);
			}
		}
		if (!found[2]) break;
	}
	return { codes, warnings };
}

export function ignoredCodes(text: string): string[] {
	const match = ignorePrefix.exec(text);
	if (match === null) return [];
	const codes: string[] = [];
	for (const found of text.slice(match[0].length).matchAll(/[\w$-]+/gm)) {
		const code = found[0];
		codes.push(code);
		if (!ignorableCodes.has(code)) {
			const replaced = replacement(code);
			if (ignorableCodes.has(replaced)) codes.push(replaced);
		}
	}
	return codes;
}
