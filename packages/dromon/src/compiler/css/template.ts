import type * as ES from 'estree';
import type * as IR from '../ir/nodes.ts';
import type { ComponentUnit } from '../ir/port.ts';

export type Host = IR.Element | IR.DynamicElement;

export type Renderer = IR.Render | IR.Component;

interface Place {
	readonly fragment: IR.Fragment;
	readonly owner: IR.Node | null;
}

type Resolution = 'resolved' | 'unresolved';

function fragmentsOf(node: IR.Node): (IR.Fragment | null)[] {
	switch (node.kind) {
		case 'element':
		case 'component':
		case 'dynamic-element':
		case 'keyed-block':
		case 'boundary':
		case 'snippet':
		case 'special':
			return [node.body];
		case 'slot':
			return [node.fallback];
		case 'branch':
			return [...node.arms.map((arm) => arm.body), node.fallback];
		case 'keyed-list':
		case 'unkeyed-list':
			return [node.body, node.fallback];
		case 'async-block':
			return [node.pending, node.resolved?.body ?? null, node.rejected?.body ?? null];
		default:
			return [];
	}
}

export function isBlock(node: IR.Node): boolean {
	switch (node.kind) {
		case 'branch':
		case 'keyed-list':
		case 'unkeyed-list':
		case 'async-block':
		case 'keyed-block':
		case 'slot':
			return true;
		default:
			return false;
	}
}

function patternNames(pattern: ES.Node | null, into: Set<string>): void {
	if (pattern === null) return;
	switch (pattern.type) {
		case 'Identifier':
			into.add(pattern.name);
			return;
		case 'ObjectPattern':
			for (const property of pattern.properties) {
				patternNames(property.type === 'RestElement' ? property.argument : property.value, into);
			}
			return;
		case 'ArrayPattern':
			for (const element of pattern.elements) patternNames(element, into);
			return;
		case 'RestElement':
			patternNames(pattern.argument, into);
			return;
		case 'AssignmentPattern':
			patternNames(pattern.left, into);
			return;
		default:
			return;
	}
}

function scriptNames(
	program: ES.Program | null,
	unit: ComponentUnit,
	resolved: Set<string>,
	unresolved: Set<string>
): void {
	if (program === null) return;
	for (const statement of program.body) {
		const declaration =
			statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
		if (declaration === null || declaration === undefined) continue;
		switch (declaration.type) {
			case 'ImportDeclaration':
				for (const specifier of declaration.specifiers) resolved.add(specifier.local.name);
				break;
			case 'FunctionDeclaration':
			case 'ClassDeclaration':
				if (declaration.id) unresolved.add(declaration.id.name);
				break;
			case 'VariableDeclaration':
				for (const declarator of declaration.declarations) {
					const init = declarator.init;
					const props = init?.type === 'CallExpression' && unit.runes.get(init.callee) === '$props';
					patternNames(declarator.id, props ? resolved : unresolved);
				}
				break;
			default:
				break;
		}
	}
}

export class TemplateIndex {
	readonly hosts: Host[] = [];
	readonly snippets: IR.Snippet[] = [];
	readonly #places = new Map<IR.Node, Place>();
	readonly #renders = new Map<Renderer, Set<IR.Snippet>>();
	readonly #sites = new Map<IR.Snippet, Set<Renderer>>();
	readonly #resolved = new Set<string>();
	readonly #script = new Set<string>();

	constructor(unit: ComponentUnit) {
		scriptNames(unit.module, unit, this.#resolved, this.#script);
		scriptNames(unit.instance, unit, this.#resolved, this.#script);
		const unresolved: Renderer[] = [];
		this.#fragment(unit.template, null, [], unresolved);
		for (const renderer of unresolved) {
			const set = this.#renders.get(renderer) ?? new Set();
			for (const snippet of this.snippets) set.add(snippet);
			this.#renders.set(renderer, set);
		}
		for (const [renderer, snippets] of this.#renders) {
			for (const snippet of snippets) {
				const sites = this.#sites.get(snippet) ?? new Set();
				sites.add(renderer);
				this.#sites.set(snippet, sites);
			}
		}
	}

	#fragment(
		fragment: IR.Fragment,
		owner: IR.Node | null,
		scopes: readonly ReadonlyMap<string, IR.Snippet | null>[],
		unresolved: Renderer[]
	): void {
		const scope = new Map<string, IR.Snippet | null>();
		for (const node of fragment.nodes) {
			if (node.kind === 'snippet') scope.set(node.name.name, node);
			else if (node.kind === 'constant') {
				const names = new Set<string>();
				patternNames(node.declarator.id, names);
				for (const name of names) scope.set(name, null);
			}
		}
		const inner = scope.size > 0 ? [...scopes, scope] : scopes;
		for (const node of fragment.nodes) {
			this.#places.set(node, { fragment, owner });
			if (node.kind === 'element' || node.kind === 'dynamic-element') this.hosts.push(node);
			if (node.kind === 'snippet') this.snippets.push(node);
			if (node.kind === 'render') this.#render(node, inner, unresolved);
			if (node.kind === 'component') this.#component(node, inner, unresolved);
			const own = this.#declared(node);
			const nested = own.size > 0 ? [...inner, own] : inner;
			for (const child of fragmentsOf(node)) {
				if (child !== null) this.#fragment(child, node, nested, unresolved);
			}
		}
	}

	#declared(node: IR.Node): Map<string, IR.Snippet | null> {
		const names = new Set<string>();
		switch (node.kind) {
			case 'keyed-list':
			case 'unkeyed-list':
				patternNames(node.item, names);
				if (node.index !== null) names.add(node.index.name);
				break;
			case 'snippet':
				for (const parameter of node.parameters) patternNames(parameter, names);
				break;
			case 'async-block':
				patternNames(node.resolved?.binding ?? null, names);
				patternNames(node.rejected?.binding ?? null, names);
				break;
			default:
				break;
		}
		const declared = new Map<string, IR.Snippet | null>();
		for (const name of names) declared.set(name, null);
		return declared;
	}

	#lookup(
		name: string,
		scopes: readonly ReadonlyMap<string, IR.Snippet | null>[]
	): IR.Snippet | Resolution {
		for (let i = scopes.length - 1; i >= 0; i--) {
			const scope = scopes[i];
			if (scope?.has(name)) return scope.get(name) ?? 'unresolved';
		}
		if (this.#script.has(name)) return 'unresolved';
		return 'resolved';
	}

	#add(renderer: Renderer, snippet: IR.Snippet): void {
		const set = this.#renders.get(renderer) ?? new Set();
		set.add(snippet);
		this.#renders.set(renderer, set);
	}

	#render(
		node: IR.Render,
		scopes: readonly ReadonlyMap<string, IR.Snippet | null>[],
		unresolved: Renderer[]
	): void {
		const call = node.call.type === 'ChainExpression' ? node.call.expression : node.call;
		const callee = call.type === 'CallExpression' ? call.callee : null;
		this.#renders.set(node, new Set());
		if (callee?.type !== 'Identifier') {
			unresolved.push(node);
			return;
		}
		const found = this.#lookup(callee.name, scopes);
		if (found === 'unresolved') unresolved.push(node);
		else if (found !== 'resolved') this.#add(node, found);
	}

	#component(
		node: IR.Component,
		scopes: readonly ReadonlyMap<string, IR.Snippet | null>[],
		unresolved: Renderer[]
	): void {
		this.#renders.set(node, new Set());
		let resolved = true;
		for (const attribute of node.attributes) {
			if (attribute.kind === 'spread' || attribute.kind === 'binding') {
				resolved = false;
				continue;
			}
			if (attribute.kind !== 'attribute') continue;
			const expression = attributeExpression(attribute.value);
			if (expression === null) continue;
			if (expression.type === 'Identifier') {
				const found = this.#lookup(expression.name, scopes);
				if (found === 'unresolved') resolved = false;
				else if (found !== 'resolved') this.#add(node, found);
			} else if (expression.type !== 'Literal') {
				resolved = false;
			}
		}
		if (!resolved) {
			unresolved.push(node);
			return;
		}
		for (const child of node.body.nodes) {
			if (child.kind === 'snippet') this.#add(node, child);
		}
	}

	place(node: IR.Node): Place | null {
		return this.#places.get(node) ?? null;
	}

	owner(node: IR.Node): IR.Node | null {
		return this.#places.get(node)?.owner ?? null;
	}

	snippetsOf(renderer: Renderer): ReadonlySet<IR.Snippet> {
		return this.#renders.get(renderer) ?? new Set();
	}

	sitesOf(snippet: IR.Snippet): ReadonlySet<Renderer> {
		return this.#sites.get(snippet) ?? new Set();
	}

	insideHead(node: IR.Node): boolean {
		for (let owner = this.owner(node); owner !== null; owner = this.owner(owner)) {
			if (owner.kind === 'special' && owner.target === 'head') return true;
		}
		return false;
	}

	fragments(node: IR.Node): (IR.Fragment | null)[] {
		return fragmentsOf(node);
	}
}

export function attributeExpression(value: IR.Value): ES.Expression | null {
	if (value.kind === 'expression') return value.expression;
	if (value.kind === 'text' && value.parts.length === 1 && value.parts[0]?.kind === 'expression') {
		return value.parts[0].expression;
	}
	return null;
}

export function hostName(host: Host): string {
	return host.kind === 'element' ? host.name : 'svelte:element';
}
