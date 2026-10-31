import type * as ES from 'estree';
import {
	parseExpression,
	parseProgram,
	type Attribute,
	type ComponentUnit,
	type Fragment,
	type Node,
	type Rune,
	type Span
} from 'vigla/compiler';

const runes = new Set<string>(['$props', '$state', '$state.raw', '$derived', '$derived.by']);

const skipped = new Set(['type', 'loc', 'range', 'start', 'end']);

function calleeName(callee: ES.Node): string | null {
	if (callee.type === 'Identifier') return callee.name;
	if (
		callee.type === 'MemberExpression' &&
		callee.object.type === 'Identifier' &&
		callee.property.type === 'Identifier' &&
		!callee.computed
	) {
		return `${callee.object.name}.${callee.property.name}`;
	}
	return null;
}

export class Source {
	#text = '';
	readonly #runes = new Map<ES.Node, Rune>();
	readonly #ignores = new Map<object, ReadonlySet<string>>();

	#append(code: string): number {
		const start = this.#text.length;
		this.#text += `${code}\n`;
		return start;
	}

	#mark(node: ES.Node): void {
		if (node.type === 'CallExpression') {
			const name = calleeName(node.callee);
			if (name !== null && runes.has(name)) this.#runes.set(node.callee, name as Rune);
		}
		for (const key of Object.keys(node)) {
			if (skipped.has(key)) continue;
			const value = (node as unknown as Record<string, unknown>)[key];
			for (const item of Array.isArray(value) ? value : [value]) {
				if (typeof item === 'object' && item !== null && typeof (item as ES.Node).type === 'string')
					this.#mark(item as ES.Node);
			}
		}
	}

	span(): Span {
		const start = this.#append(' ');
		return { start, end: start + 1 };
	}

	expression(code: string): ES.Expression {
		const start = this.#append(code);
		const node = parseExpression(this.#text, start);
		this.#mark(node);
		return node;
	}

	program(code: string): ES.Program {
		const start = this.#append(code);
		const program = parseProgram(this.#text, start, start + code.length);
		this.#mark(program);
		return program;
	}

	declaration(code: string): ES.VariableDeclaration {
		return this.program(code).body[0] as ES.VariableDeclaration;
	}

	parameters(code: string): ES.Pattern[] {
		return (this.expression(`(${code}) => {}`) as ES.ArrowFunctionExpression).params;
	}

	ignore<T extends object>(node: T, codes: readonly string[]): T {
		this.#ignores.set(node, new Set(codes));
		return node;
	}

	unit(filename: string, instance: ES.Program | null, nodes: readonly Node[]): ComponentUnit {
		return {
			kind: 'component',
			source: this.#text,
			filename,
			module: null,
			instance,
			template: { nodes },
			style: null,
			options: null,
			runes: this.#runes,
			ignores: this.#ignores
		};
	}
}

export function fragment(...nodes: Node[]): Fragment {
	return { nodes };
}

export function text(source: Source, data: string): Node {
	return { kind: 'text', ...source.span(), data };
}

export function show(source: Source, code: string): Node {
	return { kind: 'expression', ...source.span(), expression: source.expression(code) };
}

export function property(source: Source, name: string, code: string): Attribute {
	return {
		kind: 'attribute',
		...source.span(),
		name,
		value: { kind: 'expression', expression: source.expression(code) }
	};
}

export function literal(source: Source, name: string, data: string): Attribute {
	return {
		kind: 'attribute',
		...source.span(),
		name,
		value: { kind: 'text', parts: [{ kind: 'text', ...source.span(), data }] }
	};
}

export function binding(source: Source, name: string, code: string): Attribute {
	return { kind: 'binding', ...source.span(), name, expression: source.expression(code) };
}

export function element(
	source: Source,
	name: string,
	attributes: readonly Attribute[],
	...body: Node[]
): Node {
	return { kind: 'element', ...source.span(), name, attributes, body: fragment(...body) };
}

export function component(
	source: Source,
	reference: string,
	attributes: readonly Attribute[],
	...body: Node[]
): Node {
	return {
		kind: 'component',
		...source.span(),
		reference: source.expression(reference),
		attributes,
		body: fragment(...body)
	};
}

export function when(
	source: Source,
	test: string,
	body: Fragment,
	fallback: Fragment | null
): Node {
	const span = source.span();
	return {
		kind: 'branch',
		...span,
		arms: [{ ...span, test: source.expression(test), body }],
		fallback
	};
}

export function snippet(source: Source, name: string, parameters: string, ...body: Node[]): Node {
	return {
		kind: 'snippet',
		...source.span(),
		name: source.expression(name) as ES.Identifier,
		parameters: source.parameters(parameters),
		body: fragment(...body)
	};
}

export function render(source: Source, call: string): Node {
	return {
		kind: 'render',
		...source.span(),
		call: source.expression(call) as ES.SimpleCallExpression
	};
}

export function boundary(source: Source, attributes: readonly Attribute[], ...body: Node[]): Node {
	return { kind: 'boundary', ...source.span(), attributes, body: fragment(...body) };
}

export function declare(source: Source, code: string): Node {
	return { kind: 'declaration', ...source.span(), declaration: source.declaration(code) };
}
