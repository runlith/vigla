import { OPEN_ELSE } from '../../shared/markers.ts';
import { block } from '../reactivity/effects.ts';
import { Branches, REPAIRED } from './branches.ts';
import { hydrating, instruction } from './hydration.ts';
import type { Render } from './template.ts';

export type Snippet = (anchor: ChildNode, ...args: (() => unknown)[]) => void;

export type Mountable = (anchor: ChildNode, props: Record<string, unknown>) => unknown;

function swap<T>(
	node: ChildNode,
	select: () => T,
	content: (value: NonNullable<T>) => Render | null,
	marked: boolean
): void {
	const branches = new Branches<T | null>(node, true);
	let first = true;
	block(() => {
		const value = select() ?? null;
		const render = (): Render | null => (value === null ? null : content(value as NonNullable<T>));
		if (!first) {
			branches.show(value, render);
			return;
		}
		first = false;
		const shown = render();
		const matched =
			hydrating && marked ? (instruction(node) !== OPEN_ELSE) === (shown !== null) : null;
		branches.start(value, shown, matched, REPAIRED);
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
	reference: () => Mountable | false | 0 | '' | null | undefined,
	mount: (anchor: ChildNode, component: Mountable) => void
): void {
	swap(node, reference, (fn) => (fn ? (anchor) => mount(anchor, fn) : null), true);
}

type Props = Record<PropertyKey, unknown>;

type PropsSource = Props | (() => Props | null | undefined);

function resolve(source: PropsSource): Props | null | undefined {
	return typeof source === 'function' ? source() : source;
}

function owning(sources: readonly PropsSource[], key: PropertyKey): Props | undefined {
	for (let index = sources.length - 1; index >= 0; index--) {
		const found = resolve(sources[index] as PropsSource);
		if (found != null && Object.hasOwn(found, key)) return found;
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
