import { warningCodes } from './diagnostics.ts';

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
