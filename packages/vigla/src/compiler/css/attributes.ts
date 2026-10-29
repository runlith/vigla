import type * as ES from 'estree';
import type * as IR from '../ir/nodes.ts';
import type { Host } from './template.ts';

const unknown = Symbol('unknown');

type Possible = string | number | boolean | typeof unknown;

function gather(node: ES.Node, isClass: boolean, set: Set<Possible>, nested = false): void {
	if (set.has(unknown)) return;
	switch (node.type) {
		case 'Literal':
			set.add(String(node.value));
			return;
		case 'ConditionalExpression':
			gather(node.consequent, isClass, set, nested);
			gather(node.alternate, isClass, set, nested);
			return;
		case 'LogicalExpression':
			if (node.operator === '&&') {
				const left = new Set<Possible>();
				gather(node.left, isClass, left, nested);
				if (left.has(unknown)) {
					if (!isClass || !nested) {
						set.add('');
						set.add(false);
						set.add(Number.NaN);
						set.add(0);
					}
				} else {
					for (const value of left) {
						if (!value && value !== undefined && (!isClass || !nested)) set.add(value);
					}
				}
				gather(node.right, isClass, set, nested);
			} else {
				gather(node.left, isClass, set, nested);
				gather(node.right, isClass, set, nested);
			}
			return;
		case 'ArrayExpression':
			if (!isClass) break;
			for (const entry of node.elements) if (entry) gather(entry, isClass, set, true);
			return;
		case 'ObjectExpression':
			if (!isClass) break;
			for (const property of node.properties) {
				if (
					property.type === 'Property' &&
					!property.computed &&
					(property.key.type === 'Identifier' || property.key.type === 'Literal')
				) {
					set.add(
						property.key.type === 'Identifier' ? property.key.name : String(property.key.value)
					);
				} else {
					set.add(unknown);
				}
			}
			return;
		default:
			break;
	}
	set.add(unknown);
}

function possibleValues(chunk: IR.Text | IR.Expression, isClass: boolean): string[] | null {
	const values = new Set<Possible>();
	if (chunk.kind === 'text') values.add(chunk.data);
	else gather(chunk.expression, isClass, values);
	if (values.has(unknown)) return null;
	return [...values].map((value) => String(value));
}

function test(
	operator: string | null,
	expected: string,
	insensitive: boolean,
	actual: string
): boolean {
	const want = insensitive ? expected.toLowerCase() : expected;
	const value = insensitive ? actual.toLowerCase() : actual;
	switch (operator) {
		case '=':
			return value === want;
		case '~=':
			return value.split(/\s/).includes(want);
		case '|=':
			return `${value}-`.startsWith(`${want}-`);
		case '^=':
			return value.startsWith(want);
		case '$=':
			return value.endsWith(want);
		case '*=':
			return value.includes(want);
		default:
			throw new Error(`Unknown attribute selector operator ${operator}`);
	}
}

function chunksOf(value: IR.Value): readonly (IR.Text | IR.Expression)[] {
	if (value.kind === 'text') return value.parts;
	if (value.kind === 'expression') {
		return [{ kind: 'expression', expression: value.expression, start: -1, end: -1 }];
	}
	return [];
}

const leading = /^\s/;
const trailing = /\s$/;

function combinations(value: IR.Value, isClass: boolean): Set<string> | null {
	const possible = new Set<string>();
	let previous: string[] = [];
	for (const chunk of chunksOf(value)) {
		const current = possibleValues(chunk, isClass);
		if (current === null) return null;
		if (previous.length > 0) {
			const spaced: string[] = [];
			const remaining: string[] = [];
			for (const option of current) (leading.test(option) ? spaced : remaining).push(option);
			if (remaining.length > 0) {
				if (spaced.length > 0) for (const option of previous) possible.add(option);
				const combined: string[] = [];
				for (const before of previous) for (const after of remaining) combined.push(before + after);
				previous = combined;
				for (const option of spaced) {
					if (trailing.test(option)) possible.add(option);
					else previous.push(option);
				}
				continue;
			}
			for (const option of previous) possible.add(option);
			previous = [];
		}
		for (const option of current) {
			if (trailing.test(option)) possible.add(option);
			else previous.push(option);
		}
		if (previous.length < current.length) previous.push(' ');
		if (previous.length > 20) return null;
	}
	for (const option of previous) possible.add(option);
	return possible;
}

function staticText(value: IR.Value): string | null {
	if (value.kind !== 'text') return null;
	if (value.parts.length === 0) return '';
	const only = value.parts[0];
	return value.parts.length === 1 && only?.kind === 'text' ? only.data : null;
}

export function attributeMatches(
	host: Host,
	name: string,
	expected: string | null,
	operator: string | null,
	insensitive: boolean
): boolean {
	const lower = name.toLowerCase();
	for (const attribute of host.attributes) {
		switch (attribute.kind) {
			case 'spread':
				return true;
			case 'binding':
				if (attribute.name === name) return true;
				continue;
			case 'style':
				if (lower === 'style') return true;
				continue;
			case 'class':
				if (lower !== 'class') continue;
				if (operator !== '~=' || attribute.name === expected) return true;
				continue;
			case 'attribute':
				break;
			default:
				continue;
		}
		if (attribute.name.toLowerCase() !== lower) continue;
		if (attribute.value.kind === 'boolean') return operator === null;
		if (expected === null) return true;
		const text = staticText(attribute.value);
		if (text !== null) {
			const matches = test(operator, expected, insensitive, text);
			if (!matches && (lower === 'class' || lower === 'style')) continue;
			return matches;
		}
		const possible = combinations(attribute.value, lower === 'class');
		if (possible === null) return true;
		for (const value of possible) if (test(operator, expected, insensitive, value)) return true;
	}
	return false;
}
