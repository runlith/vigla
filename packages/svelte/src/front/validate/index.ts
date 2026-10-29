import type { Diagnostic } from 'dromon/compiler';
import type * as AST from '../ast.ts';
import { bidirectionalChar } from '../parse/characters.ts';
import type { Parsed } from '../parse/index.ts';
import { fail } from '../diagnostics.ts';
import { rejectLegacy } from './legacy.ts';
import { Report } from './report.ts';
import { Template } from './template.ts';

export interface ValidateOptions {
	readonly customElement: boolean;
	readonly filename: string | undefined;
}

const bidirectional = bidirectionalChar;

type Node = { type: string; [key: string]: unknown };

function literals(node: unknown, report: Report): void {
	if (node === null || typeof node !== 'object') return;
	if (Array.isArray(node)) {
		for (const item of node) literals(item, report);
		return;
	}
	const record = node as Node;
	if (typeof record.type !== 'string') return;
	if (
		record.type === 'Literal' &&
		typeof record.value === 'string' &&
		bidirectional.test(record.value)
	) {
		report.warn('bidirectional_control_characters', record as never);
	}
	if (record.type === 'TemplateElement') {
		const cooked = (record.value as { cooked?: string | null }).cooked ?? '';
		if (bidirectional.test(cooked))
			report.warn('bidirectional_control_characters', record as never);
	}
	for (const key in record) {
		if (
			key !== 'type' &&
			key !== 'loc' &&
			key !== 'leadingComments' &&
			key !== 'trailingComments'
		) {
			literals(record[key], report);
		}
	}
}

export function phases(root: AST.Root): (diagnostic: Diagnostic) => number {
	const inside = (part: AST.Located | null | undefined, at: number): boolean =>
		part !== null && part !== undefined && at >= part.start && at < part.end;
	return (diagnostic) => {
		if (inside(root.module, diagnostic.start)) return 1;
		if (inside(root.instance, diagnostic.start)) return 2;
		if (inside(root.css, diagnostic.start)) return 4;
		return 3;
	};
}

export function merge(
	first: readonly Diagnostic[],
	second: readonly Diagnostic[],
	phase: (diagnostic: Diagnostic) => number
): Diagnostic[] {
	const merged: Diagnostic[] = [];
	let left = 0;
	let right = 0;
	while (left < first.length && right < second.length) {
		const a = first[left] as Diagnostic;
		const b = second[right] as Diagnostic;
		const order = phase(a) - phase(b) || a.start - b.start;
		if (order <= 0) {
			merged.push(a);
			left++;
		} else {
			merged.push(b);
			right++;
		}
	}
	return merged.concat(first.slice(left), second.slice(right));
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
	readonly walk: readonly Diagnostic[];
}

export interface Phased {
	readonly before: readonly Diagnostic[];
	readonly module: readonly Diagnostic[];
	readonly instance: readonly Diagnostic[];
	readonly template: readonly Diagnostic[];
}

export function phased(
	root: AST.Root,
	before: readonly Diagnostic[],
	walk: readonly Diagnostic[]
): Phased {
	const phase = phases(root);
	const lists: Diagnostic[][] = [[], [], [], [], []];
	for (const diagnostic of walk) (lists[phase(diagnostic)] as Diagnostic[]).push(diagnostic);
	const byStart = (list: Diagnostic[]): Diagnostic[] => list.sort((a, b) => a.start - b.start);
	return {
		before,
		module: byStart(lists[1] as Diagnostic[]),
		instance: byStart(lists[2] as Diagnostic[]),
		template: byStart([...(lists[3] as Diagnostic[]), ...(lists[4] as Diagnostic[])])
	};
}

export function validateComponent(
	parsed: Parsed,
	source: string,
	options: ValidateOptions
): Validated {
	const root = parsed.root;
	rejectLegacy(root, options);
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
	const report = new Report();
	literals(root.module, report);
	literals(root.instance, report);
	new Template(source, report).fragment(root.fragment, root);
	literals(root.fragment, report);
	const phase = phases(root);
	const walk = [...report.warnings].sort((a, b) => phase(a) - phase(b) || a.start - b.start);
	return { parse: parsed.warnings, before: early.warnings, walk };
}
