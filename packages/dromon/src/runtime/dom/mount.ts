import { root } from '../reactivity/effects.ts';
import { build, discard, type Built } from './range.ts';

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

const mounted = new WeakMap<object, Built>();

export function mount<P extends Props, E extends Exports>(
	component: Component<P, E>,
	options: MountOptions<P>
): E {
	let exports: E | void = undefined;
	const built = build((anchor) => {
		exports = component(anchor, options.props ?? ({} as P));
	}, root);
	const instance = (exports ?? {}) as E;
	mounted.set(instance, built);
	options.target.insertBefore(built.fragment as DocumentFragment, options.anchor ?? null);
	built.fragment = null;
	return instance;
}

export function unmount(instance: object): Promise<void> {
	const found = mounted.get(instance);
	if (found !== undefined) {
		mounted.delete(instance);
		discard(found);
	}
	return Promise.resolve();
}
