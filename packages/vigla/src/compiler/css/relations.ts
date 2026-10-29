import type * as IR from '../ir/nodes.ts';
import { isBlock, type Host, type Renderer, type TemplateIndex } from './template.ts';

export const Existence = { Probably: 0, Definitely: 1 } as const;
export type Existence = (typeof Existence)[keyof typeof Existence];

export const Direction = { Forward: 0, Backward: 1 } as const;
export type Direction = (typeof Direction)[keyof typeof Direction];

export type Sibling = Host | Renderer | IR.Slot;

type Siblings = Map<Sibling, Existence>;

function isHost(node: IR.Node | null): node is Host {
	return node !== null && (node.kind === 'element' || node.kind === 'dynamic-element');
}

function add(from: ReadonlyMap<Sibling, Existence>, to: Siblings): void {
	for (const [node, existence] of from) {
		const current = to.get(node);
		to.set(node, current === undefined || existence > current ? existence : current);
	}
}

function definite(result: ReadonlyMap<Sibling, Existence>): boolean {
	for (const existence of result.values()) if (existence === Existence.Definitely) return true;
	return false;
}

function hasSlotAttribute(node: IR.Element): boolean {
	return node.attributes.some(
		(attribute) => attribute.kind === 'attribute' && attribute.name.toLowerCase() === 'slot'
	);
}

export class Relations {
	readonly #index: TemplateIndex;

	constructor(index: TemplateIndex) {
		this.#index = index;
	}

	parent(node: IR.Node): Host | null {
		for (let owner = this.#index.owner(node); owner !== null; owner = this.#index.owner(owner)) {
			if (isHost(owner)) return owner;
		}
		return null;
	}

	ancestors(node: IR.Node, adjacent: boolean, seen = new Set<IR.Snippet>()): Host[] {
		const ancestors: Host[] = [];
		const chain: IR.Node[] = [];
		for (let owner = this.#index.owner(node); owner !== null; owner = this.#index.owner(owner)) {
			chain.push(owner);
		}
		for (let i = 0; i < chain.length; i++) {
			const parent = chain[i] as IR.Node;
			if (parent.kind === 'snippet') {
				if (!seen.has(parent)) {
					seen.add(parent);
					for (const site of this.#index.sitesOf(parent)) {
						ancestors.push(...this.ancestors(site, adjacent, seen));
					}
				}
				break;
			}
			if (!isHost(parent)) continue;
			if (parent.kind === 'element' && parent.name === 'option') {
				const direct = ancestors.length === 0;
				const select = chain
					.slice(i + 1)
					.find((element) => element.kind === 'element' && element.name === 'select');
				if (select !== undefined && (!adjacent || direct)) {
					const content = this.#selectedContent(select);
					if (adjacent && direct && content !== null) return [content, parent];
					if (content !== null) ancestors.push(content);
				}
			}
			ancestors.push(parent);
			if (adjacent) break;
		}
		return ancestors;
	}

	#selectedContent(node: IR.Node): IR.Element | null {
		for (const fragment of this.#index.fragments(node)) {
			if (fragment === null) continue;
			for (const child of fragment.nodes) {
				if (child.kind === 'element' && child.name === 'selectedcontent') return child;
				const found = this.#selectedContent(child);
				if (found !== null) return found;
			}
		}
		return null;
	}

	descendants(node: Host | IR.Render, adjacent: boolean): Host[] {
		const descendants: Host[] = [];
		const seen = new Set<IR.Snippet>();
		const visit = (child: IR.Node): void => {
			if (isHost(child)) {
				descendants.push(child);
				if (adjacent) return;
			} else if (child.kind === 'render') {
				for (const snippet of this.#index.snippetsOf(child)) {
					if (seen.has(snippet)) continue;
					seen.add(snippet);
					for (const inner of snippet.body.nodes) visit(inner);
				}
				return;
			}
			for (const fragment of this.#index.fragments(child)) {
				if (fragment !== null) for (const inner of fragment.nodes) visit(inner);
			}
		};
		if (node.kind === 'render') visit(node);
		else for (const child of node.body.nodes) visit(child);

		if (node.kind === 'element' && node.name === 'selectedcontent') {
			let select: IR.Node | null = this.#index.owner(node);
			while (select !== null && !(select.kind === 'element' && select.name === 'select')) {
				select = this.#index.owner(select);
			}
			if (select !== null) this.#options(select, false, visit);
		}
		return descendants;
	}

	#options(node: IR.Node, inside: boolean, visit: (child: IR.Node) => void): void {
		for (const fragment of this.#index.fragments(node)) {
			if (fragment === null) continue;
			for (const child of fragment.nodes) {
				if (child.kind === 'element' && child.name === 'option') this.#options(child, true, visit);
				else if (inside) visit(child);
				else this.#options(child, false, visit);
			}
		}
	}

	siblings(
		node: IR.Node,
		direction: Direction,
		adjacent: boolean,
		seen = new Set<IR.Snippet>()
	): Siblings {
		const result: Siblings = new Map();
		let current: IR.Node = node;
		for (;;) {
			const place = this.#index.place(current);
			if (place === null) break;
			const nodes = place.fragment.nodes;
			const step = direction === Direction.Forward ? 1 : -1;
			for (let j = nodes.indexOf(current) + step; j >= 0 && j < nodes.length; j += step) {
				const sibling = nodes[j] as IR.Node;
				if (sibling.kind === 'element') {
					if (!hasSlotAttribute(sibling)) {
						result.set(sibling, Existence.Definitely);
						if (adjacent) return result;
					}
				} else if (isBlock(sibling) || sibling.kind === 'component') {
					if (sibling.kind === 'slot' || sibling.kind === 'component') {
						result.set(sibling, Existence.Probably);
					}
					const last = this.nested(sibling, direction, adjacent);
					add(last, result);
					if (adjacent && sibling.kind !== 'component' && definite(last)) return result;
				} else if (sibling.kind === 'dynamic-element') {
					result.set(sibling, Existence.Probably);
				} else if (sibling.kind === 'render') {
					result.set(sibling, Existence.Probably);
					for (const snippet of this.#index.snippetsOf(sibling)) {
						add(this.nested(snippet, direction, adjacent), result);
					}
				}
			}

			const owner = place.owner;
			if (owner === null) break;
			current = owner;
			if (owner.kind === 'component') continue;
			if (owner.kind === 'snippet') {
				if (seen.has(owner)) break;
				seen.add(owner);
				const sites = this.#index.sitesOf(owner);
				for (const site of sites) {
					const found = this.siblings(site, direction, adjacent, seen);
					add(found, result);
					if (adjacent && sites.size === 1 && definite(found)) return result;
				}
			}
			if (!isBlock(owner)) break;
			if (
				(owner.kind === 'keyed-list' || owner.kind === 'unkeyed-list') &&
				place.fragment === owner.body
			) {
				add(this.nested(owner, direction, adjacent), result);
			}
		}
		return result;
	}

	nested(
		node: IR.Node,
		direction: Direction,
		adjacent: boolean,
		seen = new Set<IR.Snippet>()
	): Siblings {
		let fragments: (IR.Fragment | null)[];
		if (node.kind === 'snippet') {
			if (seen.has(node)) return new Map();
			seen.add(node);
			fragments = [node.body];
		} else if (node.kind === 'component') {
			fragments = [node.body, ...[...this.#index.snippetsOf(node)].map((s) => s.body)];
		} else {
			fragments = this.#index.fragments(node);
		}
		const result: Siblings = new Map();
		let exhaustive = node.kind !== 'slot' && node.kind !== 'snippet';
		for (const fragment of fragments) {
			if (fragment === null) {
				exhaustive = false;
				continue;
			}
			const map = this.#children(fragment.nodes, direction, adjacent, seen);
			exhaustive &&= definite(map);
			add(map, result);
		}
		if (!exhaustive) for (const key of result.keys()) result.set(key, Existence.Probably);
		return result;
	}

	#children(
		children: readonly IR.Node[],
		direction: Direction,
		adjacent: boolean,
		seen: Set<IR.Snippet>
	): Siblings {
		const result: Siblings = new Map();
		const step = direction === Direction.Forward ? 1 : -1;
		for (
			let i = direction === Direction.Forward ? 0 : children.length - 1;
			i >= 0 && i < children.length;
			i += step
		) {
			const child = children[i] as IR.Node;
			if (child.kind === 'element') {
				result.set(child, Existence.Definitely);
				if (adjacent) break;
			} else if (child.kind === 'dynamic-element') {
				result.set(child, Existence.Probably);
			} else if (child.kind === 'render') {
				for (const snippet of this.#index.snippetsOf(child)) {
					add(this.nested(snippet, direction, adjacent, seen), result);
				}
			} else if (isBlock(child)) {
				const found = this.nested(child, direction, adjacent, seen);
				add(found, result);
				if (adjacent && definite(found)) break;
			}
		}
		return result;
	}
}
