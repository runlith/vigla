import { failure, isFailure, warn } from '../../shared/diagnostics.ts';
import { format as nativeFormat, type Format } from '../../shared/format.ts';
import { OPEN } from '../../shared/markers.ts';
import { destroy, detached } from '../reactivity/effects.ts';
import type { Effect } from '../reactivity/graph.ts';
import { owner } from '../reactivity/tracking.ts';
import { introducing } from '../transitions/manager.ts';
import { transformAt } from './boundary.ts';
import { delegateRoot } from './events.ts';
import {
	claim,
	COMMENT,
	cursor,
	hydrating,
	isClose,
	MISMATCH,
	mismatch,
	setHydrating
} from './hydration.ts';
import { withContext } from './context.ts';
import { entry, mountRoot } from './props.ts';
import { withHydration } from './data.ts';
import { build, discard, type Built } from './range.ts';

export type Props = Record<string, unknown>;

export type Exports = Record<string, unknown>;

export type Component<P extends Props = Props, E extends Exports = Exports> = (
	anchor: ChildNode,
	props: P
) => E | void;

export interface MountOptions<P extends Props> {
	readonly target: ParentNode;
	readonly format?: Format;
	readonly props?: P;
	readonly anchor?: ChildNode | null;
	readonly intro?: boolean;
	readonly context?: Map<unknown, unknown>;
	readonly transformError?: (error: unknown) => unknown;
}

export interface HydrateOptions<P extends Props> extends MountOptions<P> {
	readonly recover?: boolean;
}

interface Mounted {
	readonly built: Built;
	readonly release: () => void;
}

const mounted = new WeakMap<object, Mounted>();

function start<P extends Props, E extends Exports>(
	component: Component<P, E>,
	options: MountOptions<P>
): { instance: E; built: Built } {
	let exports: E | void = undefined;
	const props = options.props ?? ({} as P);
	entry(props);
	const parent = owner;
	const create = (fn: () => void): Effect =>
		detached(() => {
			mountRoot(owner as Effect);
			fn();
		}, parent);
	const built = introducing(options.intro ?? true, () =>
		build((anchor) => {
			if (owner !== null) transformAt(owner, options.transformError);
			exports = withHydration(options.format ?? nativeFormat, options.target, () =>
				withContext(options.context, () => component(anchor, props))
			);
		}, create)
	);
	return { instance: (exports ?? {}) as E, built };
}

function finish(instance: object, built: Built, target: ParentNode): void {
	mounted.set(instance, { built, release: delegateRoot(target) });
}

export function mount<P extends Props, E extends Exports>(
	component: Component<P, E>,
	options: MountOptions<P>
): E {
	const { instance, built } = start(component, options);
	options.target.insertBefore(built.fragment as DocumentFragment, options.anchor ?? null);
	built.fragment = null;
	finish(instance, built, options.target);
	return instance;
}

function opening(target: ParentNode): ChildNode | null {
	let node = target.firstChild;
	while (node !== null && (node.nodeType !== COMMENT || (node as Comment).data !== OPEN)) {
		node = node.nextSibling;
	}
	return node;
}

export function hydrate<P extends Props, E extends Exports>(
	component: Component<P, E>,
	options: HydrateOptions<P>
): E {
	const target = options.target;
	const previous = hydrating ? cursor : null;
	const was = setHydrating(true);
	let adopted: Built | null = null;
	try {
		const open = opening(target);
		if (open === null) throw MISMATCH;
		claim(open.nextSibling);
		const { instance, built } = start(component, options);
		adopted = built;
		if (!isClose(cursor)) mismatch();
		finish(instance, built, target);
		return instance;
	} catch (error) {
		if (adopted !== null) destroy(adopted.effect);
		if (isFailure(error)) throw error;
		if (error !== MISMATCH) console.warn('Failed to hydrate: ', error);
		if (options.recover === false) {
			throw failure('hydration_failed', 'Failed to hydrate the application');
		}
		setHydrating(false);
		(target as Element).textContent = '';
		return mount(component, options);
	} finally {
		setHydrating(was);
		if (previous !== null) claim(previous);
	}
}

export function unmount(instance: object): Promise<void> {
	const found = mounted.get(instance);
	if (found === undefined) {
		warn('lifecycle_double_unmount', 'Tried to unmount a component that was not mounted');
		return Promise.resolve();
	}
	mounted.delete(instance);
	found.release();
	discard(found.built);
	return Promise.resolve();
}
