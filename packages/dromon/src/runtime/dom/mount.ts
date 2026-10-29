import { destroy, root } from '../reactivity/effects.ts';
import type { Effect } from '../reactivity/graph.ts';

export type Props = Record<string, unknown>;

export type Exports = Record<string, unknown>;

export type Component<P extends Props = Props, E extends Exports = Exports> = (
	anchor: ChildNode,
	props: P
) => E | void;

export interface MountOptions<P extends Props> {
	readonly target: ParentNode;
	readonly props?: P;
	readonly anchor?: ChildNode | null;
}

interface Mounted {
	readonly effect: Effect;
	readonly first: ChildNode | null;
	readonly last: ChildNode | null;
}

const mounted = new WeakMap<object, Mounted>();

export function mount<P extends Props, E extends Exports>(
	component: Component<P, E>,
	options: MountOptions<P>
): E {
	const fragment = document.createDocumentFragment();
	const anchor = document.createTextNode('');
	fragment.append(anchor);
	let exports: E | void = undefined;
	const effect = root(() => {
		exports = component(anchor, options.props ?? ({} as P));
	});
	anchor.remove();
	const instance = (exports ?? {}) as E;
	mounted.set(instance, { effect, first: fragment.firstChild, last: fragment.lastChild });
	options.target.insertBefore(fragment, options.anchor ?? null);
	return instance;
}

export function unmount(instance: object): Promise<void> {
	const found = mounted.get(instance);
	if (found !== undefined) {
		mounted.delete(instance);
		let node = found.first;
		while (node !== null) {
			const next: ChildNode | null = node.nextSibling;
			node.remove();
			if (node === found.last) break;
			node = next;
		}
		destroy(found.effect);
	}
	return Promise.resolve();
}
