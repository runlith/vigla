import type { Diagnostic } from 'dromon/compiler';
import type * as AST from '../ast.ts';
import { bidirectionalChar } from '../parse/characters.ts';
import type { Parsed } from '../parse/index.ts';
import { Report } from './report.ts';
import { Template } from './template.ts';

export interface ValidateOptions {
	readonly customElement: boolean;
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

export function validateComponent(
	parsed: Parsed,
	source: string,
	options: ValidateOptions
): Diagnostic[] {
	const root = parsed.root;
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
	const report = new Report();
	literals(root.module, report);
	literals(root.instance, report);
	new Template(source, report).fragment(root.fragment, root);
	literals(root.fragment, report);
	const phase = phases(root);
	const ordered = [...report.warnings].sort((a, b) => phase(a) - phase(b) || a.start - b.start);
	return [...parsed.warnings, ...early.warnings, ...ordered];
}
