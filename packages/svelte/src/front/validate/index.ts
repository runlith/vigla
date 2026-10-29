import type { Diagnostic } from 'vigla/compiler';
import type * as AST from '../ast.ts';
import { bidirectionalChar } from '../parse/characters.ts';
import type { Parsed } from '../parse/index.ts';
import type * as ES from 'estree';
import { diagnostic, fail } from '../diagnostics.ts';
import { Anchors } from './anchors.ts';
import { rejectLegacy } from './legacy.ts';
import { Report } from './report.ts';
import { Template } from './template.ts';

export interface ValidateOptions {
	readonly customElement: boolean;
	readonly filename: string | undefined;
}

const bidirectional = bidirectionalChar;

type Node = { type: string; [key: string]: unknown };

function literals(node: unknown, report: Report, anchors: Anchors): void {
	if (node === null || typeof node !== 'object') return;
	if (Array.isArray(node)) {
		for (const item of node) literals(item, report, anchors);
		return;
	}
	const record = node as Node;
	if (typeof record.type !== 'string') return;
	const text =
		record.type === 'Literal' && typeof record.value === 'string'
			? record.value
			: record.type === 'TemplateElement'
				? ((record.value as { cooked?: string | null }).cooked ?? '')
				: null;
	if (text !== null && bidirectional.test(text)) {
		const before = report.warnings.length;
		report.warn('bidirectional_control_characters', record as never);
		anchors.warn(record, report.warnings.slice(before));
	}
	for (const key in record) {
		if (
			key !== 'type' &&
			key !== 'loc' &&
			key !== 'leadingComments' &&
			key !== 'trailingComments'
		) {
			literals(record[key], report, anchors);
		}
	}
}

const forbiddenUpdates = new Set(['beforeUpdate', 'afterUpdate']);

function imports(
	program: AST.Script['content'] | ES.Program | null | undefined,
	anchors: Anchors
): void {
	for (const statement of program?.body ?? []) {
		if (statement.type !== 'ImportDeclaration') continue;
		const source = String(statement.source.value);
		const at = statement as unknown as AST.Located;
		if (source.startsWith('svelte/internal')) {
			anchors.fail(statement, diagnostic('import_svelte_internal_forbidden', at));
			continue;
		}
		if (source !== 'svelte') continue;
		for (const specifier of statement.specifiers) {
			if (specifier.type !== 'ImportSpecifier' || specifier.imported.type !== 'Identifier')
				continue;
			const name = specifier.imported.name;
			if (forbiddenUpdates.has(name)) {
				anchors.fail(
					statement,
					diagnostic('runes_mode_invalid_import', specifier as unknown as AST.Located, { name })
				);
				break;
			}
		}
	}
}

export function validateModuleSyntax(program: ES.Program): Anchors {
	const anchors = new Anchors();
	imports(program, anchors);
	return anchors;
}

function firstReference(node: unknown, name: string, parent: Node | null): Node | null {
	if (node === null || typeof node !== 'object') return null;
	if (Array.isArray(node)) {
		for (const item of node) {
			const found = firstReference(item, name, parent);
			if (found !== null) return found;
		}
		return null;
	}
	const record = node as Node;
	if (typeof record.type !== 'string') return null;
	if (record.type === 'Identifier' && record.name === name) {
		const property =
			(parent?.type === 'MemberExpression' && parent.property === record && !parent.computed) ||
			(parent?.type === 'Property' && parent.key === record && !parent.computed);
		if (!property) return record;
	}
	for (const key in record) {
		if (
			key === 'type' ||
			key === 'loc' ||
			key === 'leadingComments' ||
			key === 'trailingComments'
		) {
			continue;
		}
		const found = firstReference(record[key], name, record);
		if (found !== null) return found;
	}
	return null;
}

function rejectLegacyProps(root: AST.Root): void {
	for (const [name, code] of [
		['$$props', 'legacy_props_invalid'],
		['$$restProps', 'legacy_rest_props_invalid']
	] as const) {
		const found =
			firstReference(root.module, name, null) ??
			firstReference(root.instance, name, null) ??
			firstReference(root.fragment, name, null);
		if (found !== null) fail(code, found as unknown as AST.Located);
	}
}

export interface Validated {
	readonly parse: readonly Diagnostic[];
	readonly before: readonly Diagnostic[];
	readonly anchors: Anchors;
}

export function validateComponent(
	parsed: Parsed,
	source: string,
	options: ValidateOptions
): Validated {
	const root = parsed.root;
	const anchors = new Anchors();
	rejectLegacy(root, { ...options, anchors });
	const early = new Report();
	for (const attribute of root.options?.attributes ?? []) {
		if (
			attribute.type === 'Attribute' &&
			attribute.name === 'customElement' &&
			!options.customElement
		) {
			early.warn('options_missing_custom_element', attribute);
		}
	}
	rejectLegacyProps(root);
	imports(root.module?.content, anchors);
	imports(root.instance?.content, anchors);
	for (const statement of root.instance?.content.body ?? []) {
		if (statement.type === 'LabeledStatement' && statement.label.name === '$') {
			anchors.fail(
				statement,
				diagnostic('legacy_reactive_statement_invalid', statement as unknown as AST.Located)
			);
		}
	}
	const scripts = new Report();
	literals(root.module, scripts, anchors);
	literals(root.instance, scripts, anchors);
	new Template(source, new Report(), anchors).walk(root);
	literals(root.fragment, new Report(), anchors);
	return { parse: parsed.warnings, before: early.warnings, anchors };
}
