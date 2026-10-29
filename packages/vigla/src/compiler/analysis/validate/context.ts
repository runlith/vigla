import type * as ES from 'estree';
import { children } from '../../ir/estree.ts';
import type * as IR from '../../ir/nodes.ts';
import type { Runes, Unit } from '../../ir/port.ts';
import type { Anchors } from './front.ts';
import type { Report } from './report.ts';
import type { Scope, PathNode } from './scope.ts';
import type { Scopes } from './scopes.ts';

export type Program = 'module' | 'instance' | 'template' | null;

export interface Field {
	readonly node: ES.Node;
}

export interface Settings {
	readonly customElement: boolean;
	readonly customProps: boolean;
	readonly async: boolean;
}

export type Visit = (context: Context, node: ES.Node) => void;

export class Context {
	readonly unit: Unit;
	readonly report: Report;
	readonly scopes: Scopes;
	readonly runes: Runes;
	readonly settings: Settings;
	readonly module: Scope;
	readonly instance: Scope | null;
	readonly path: PathNode[] = [];
	readonly elements: IR.Node[] = [];
	readonly snippets: IR.Snippet[] = [];
	readonly #visit: Visit;
	readonly anchors: Anchors;
	scope: Scope;
	depth = 0;
	program: Program = null;
	parentElement: string | null = null;
	hasProps = false;
	propsId: ES.Identifier | null = null;
	fields: ReadonlyMap<string, Field> | null = null;

	constructor(
		unit: Unit,
		report: Report,
		scopes: Scopes,
		settings: Settings,
		module: Scope,
		instance: Scope | null,
		visit: Visit,
		anchors: Anchors
	) {
		this.anchors = anchors;
		this.unit = unit;
		this.report = report;
		this.scopes = scopes;
		this.runes = unit.runes;
		this.settings = settings;
		this.module = module;
		this.instance = instance;
		this.scope = module;
		this.#visit = visit;
	}

	rune(node: ES.Node | null | undefined): string | null {
		if (node?.type !== 'CallExpression') return null;
		const rune = this.runes.get(node.callee);
		if (rune === undefined) return null;
		const callee = node.callee.type === 'MemberExpression' ? node.callee.object : node.callee;
		if (callee.type === 'Identifier' && this.scope.get(callee.name)?.kind === 'store_sub')
			return null;
		return rune;
	}

	start(program: Program, scope: Scope): void {
		this.program = program;
		this.scope = scope;
		this.depth = scope.depth;
		this.hasProps = false;
		this.fields = null;
		this.parentElement = null;
	}

	es(node: ES.Node): void {
		const entered = this.report.enter(node);
		const saved = this.scope;
		const scope = this.scopes.map.get(node);
		if (scope !== undefined) this.scope = scope;
		this.anchors.emit(node);
		this.#visit(this, node);
		this.scope = saved;
		this.report.leave(entered);
	}

	next(node: ES.Node): void {
		this.path.push(node);
		children(node, (child) => this.es(child));
		this.path.pop();
	}

	deeper(depth: number, run: () => void): void {
		const saved = this.depth;
		this.depth = depth;
		run();
		this.depth = saved;
	}

	within(node: PathNode, run: () => void): void {
		this.path.push(node);
		run();
		this.path.pop();
	}

	at(offset: number): ES.Node | undefined {
		return this.path.at(offset) as ES.Node | undefined;
	}
}
