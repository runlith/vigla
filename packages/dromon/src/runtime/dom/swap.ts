import { OPEN_ELSE } from '../../shared/markers.ts';
import { atCommit } from '../reactivity/batch.ts';
import { block } from '../reactivity/effects.ts';
import { claim, cursor, hydrating, instruction, isClose, setHydrating, skip } from './hydration.ts';
import { build, discard, leave, place, type Built } from './range.ts';
import type { Render } from './template.ts';

export type Snippet = (anchor: ChildNode, ...args: (() => unknown)[]) => void;

export type Mountable = (anchor: ChildNode, props: Record<string, unknown>) => unknown;

function swap<T>(
	node: ChildNode,
	select: () => T,
	content: (value: NonNullable<T>) => Render | null,
	marked: boolean
): void {
	let anchor = node;
	let current: T | undefined;
	let shown: Built | null = null;
	let first = true;
	block(() => {
		const value = select();
		if (!first && Object.is(value, current)) return;
		current = value;
		const render = value == null ? null : content(value as NonNullable<T>);
		const previous = shown;
		if (first) {
			first = false;
			if (hydrating && marked) {
				const rendered = instruction(node) !== OPEN_ELSE;
				claim(node.nextSibling);
				if (rendered === (render !== null)) {
					shown = render === null ? null : build(render);
					anchor = isClose(cursor) ? cursor : skip();
					return;
				}
				anchor = skip();
				setHydrating(false);
				try {
					shown = render === null ? null : build(render);
				} finally {
					setHydrating(true);
				}
				if (shown !== null) place(shown, anchor);
				return;
			}
			shown = render === null ? null : build(render);
			if (hydrating) {
				anchor = cursor;
				return;
			}
			if (shown !== null) place(shown, anchor);
			return;
		}
		shown = render === null ? null : build(render);
		const next = shown;
		if (previous !== null) leave(previous);
		atCommit(() => {
			if (previous !== null) discard(previous);
			if (next !== null) place(next, anchor);
		});
	});
}

export function render(
	node: ChildNode,
	snippet: () => Snippet | null | undefined,
	...args: (() => unknown)[]
): void {
	swap(node, snippet, (fn) => (anchor) => fn(anchor, ...args), false);
}

export function component(
	node: ChildNode,
	reference: () => Mountable | null | undefined,
	mount: (anchor: ChildNode, component: Mountable) => void
): void {
	swap(node, reference, (fn) => (anchor) => mount(anchor, fn), true);
}

type Props = Record<PropertyKey, unknown>;

type PropsSource = Props | (() => Props | null | undefined);

function resolve(source: PropsSource): Props | null | undefined {
	return typeof source === 'function' ? source() : source;
}

function owning(sources: readonly PropsSource[], key: PropertyKey): Props | undefined {
	for (let index = sources.length - 1; index >= 0; index--) {
		const found = resolve(sources[index] as PropsSource);
		if (found != null && key in found) return found;
	}
	return undefined;
}

export function spreadProps(...sources: PropsSource[]): Props {
	return new Proxy({} as Props, {
		get(_target, key) {
			return owning(sources, key)?.[key];
		},
		set(_target, key, value) {
			const found = owning(sources, key);
			const setter =
				found === undefined ? undefined : Object.getOwnPropertyDescriptor(found, key)?.set;
			if (setter === undefined) return false;
			setter(value);
			return true;
		},
		has(_target, key) {
			return owning(sources, key) !== undefined;
		},
		ownKeys() {
			const keys = new Set<string | symbol>();
			for (const source of sources) {
				const found = resolve(source);
				if (found != null) for (const key of Reflect.ownKeys(found)) keys.add(key);
			}
			return [...keys];
		},
		getOwnPropertyDescriptor(_target, key) {
			const found = owning(sources, key);
			if (found === undefined) return undefined;
			const descriptor = Object.getOwnPropertyDescriptor(found, key);
			if (descriptor?.get !== undefined) {
				return { enumerable: true, configurable: true, get: descriptor.get, set: descriptor.set };
			}
			return { enumerable: true, configurable: true, value: found[key], writable: true };
		}
	});
}

export function noop(): void {}
