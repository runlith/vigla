import type * as ES from 'estree';
import type * as IR from 'dromon/compiler';
import type * as AST from './ast.ts';

const known = new Set<string>([
	'$state',
	'$state.raw',
	'$state.snapshot',
	'$state.eager',
	'$derived',
	'$derived.by',
	'$effect',
	'$effect.pre',
	'$effect.root',
	'$effect.tracking',
	'$effect.pending',
	'$props',
	'$props.id',
	'$bindable',
	'$inspect',
	'$inspect.trace',
	'$host'
]);

const skipped = new Set(['type', 'loc', 'range', 'start', 'end']);

function runeOf(callee: ES.Node): IR.Rune | null {
	let name: string | null = null;
	if (callee.type === 'Identifier') name = callee.name;
	else if (
		callee.type === 'MemberExpression' &&
		!callee.computed &&
		callee.object.type === 'Identifier' &&
		callee.property.type === 'Identifier'
	) {
		name = `${callee.object.name}.${callee.property.name}`;
	}
	return name !== null && known.has(name) ? (name as IR.Rune) : null;
}

export function collectRunes(node: ES.Node, runes: Map<ES.Node, IR.Rune>): void {
	if (node.type === 'CallExpression') {
		const rune = runeOf(node.callee);
		if (rune !== null) runes.set(node.callee, rune);
	}
	for (const key of Object.keys(node)) {
		if (skipped.has(key)) continue;
		const value = (node as unknown as Record<string, unknown>)[key];
		const items = Array.isArray(value) ? value : [value];
		for (const item of items) {
			if (typeof item === 'object' && item !== null && typeof (item as ES.Node).type === 'string') {
				collectRunes(item as ES.Node, runes);
			}
		}
	}
}

export class Lowering {
	readonly runes = new Map<ES.Node, IR.Rune>();

	expression<T extends ES.Node>(expression: T): T {
		collectRunes(expression, this.runes);
		return expression;
	}

	fragment(fragment: AST.Fragment): IR.Fragment {
		return { nodes: fragment.nodes.map((node) => this.node(node)) };
	}

	part(part: AST.Text | AST.ExpressionTag): IR.Text | IR.Expression {
		return part.type === 'Text'
			? { kind: 'text', start: part.start, end: part.end, data: part.data }
			: {
					kind: 'expression',
					start: part.start,
					end: part.end,
					expression: this.expression(part.expression)
				};
	}

	attribute(attribute: AST.Attribute): IR.Attribute {
		const { value } = attribute;
		let lowered: IR.Value;
		if (value === true) lowered = { kind: 'boolean' };
		else if (!Array.isArray(value))
			lowered = { kind: 'expression', expression: this.expression(value.expression) };
		else lowered = { kind: 'text', parts: value.map((part) => this.part(part)) };
		return {
			kind: 'attribute',
			start: attribute.start,
			end: attribute.end,
			name: attribute.name,
			value: lowered
		};
	}

	branch(block: AST.IfBlock): IR.Branch {
		const arms: IR.Arm[] = [];
		let current = block;
		let fallback: IR.Fragment | null = null;
		for (;;) {
			arms.push({
				start: current.start,
				end: current.end,
				test: this.expression(current.test),
				body: this.fragment(current.consequent)
			});
			const alternate = current.alternate;
			const [only] = alternate?.nodes ?? [];
			if (
				alternate !== null &&
				alternate.nodes.length === 1 &&
				only?.type === 'IfBlock' &&
				only.elseif
			) {
				current = only;
				continue;
			}
			fallback = alternate === null ? null : this.fragment(alternate);
			break;
		}
		return { kind: 'branch', start: block.start, end: block.end, arms, fallback };
	}

	node(node: AST.TemplateNode): IR.Node {
		switch (node.type) {
			case 'Text':
			case 'ExpressionTag':
				return this.part(node);
			case 'Comment':
				return { kind: 'comment', start: node.start, end: node.end, data: node.data };
			case 'RegularElement':
				return {
					kind: 'element',
					start: node.start,
					end: node.end,
					name: node.name,
					attributes: node.attributes.map((attribute) => this.attribute(attribute)),
					body: this.fragment(node.fragment)
				};
			case 'IfBlock':
				return this.branch(node);
			case 'EachBlock': {
				const list = {
					start: node.start,
					end: node.end,
					collection: this.expression(node.expression),
					item: node.context,
					index: null,
					body: this.fragment(node.body),
					fallback: null
				};
				return node.key === undefined
					? { kind: 'unkeyed-list', ...list }
					: { kind: 'keyed-list', ...list, key: this.expression(node.key) };
			}
		}
	}
}
