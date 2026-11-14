import {
	expose,
	type External,
	type Subscribable,
	type WritableExternal,
	type WritableSource
} from '../../shared/external.ts';
import { asyncDerived } from './async.ts';
import { destroy, effect as user, effectRoot, pre } from './effects.ts';
import { orphan } from './errors.ts';
import { external as connect } from './external.ts';
import type { Effect } from './graph.ts';
import { get } from './reads.ts';
import { memo } from './sources.ts';
import { owner, untrack } from './tracking.ts';

type Body = () => void | (() => void);

export interface Effects {
	(fn: Body): () => void;
	pre(fn: Body): () => void;
	root(fn: Body): () => void;
}

export interface Resource<T> {
	readonly current: T;
}

export interface WatchOptions<T> {
	readonly immediate?: boolean;
	readonly equals?: (previous: T, value: T) => boolean;
}

export interface Watching {
	<T>(
		source: () => T,
		changed: (value: T, previous: T | undefined) => void | (() => void),
		options: WatchOptions<T> & { readonly immediate: true }
	): () => void;
	<T>(
		source: () => T,
		changed: (value: T, previous: T) => void | (() => void),
		options?: WatchOptions<T>
	): () => void;
}

export interface Watch extends Watching {
	readonly pre: Watching;
}

function post(fn: Body): () => void {
	const created = user(fn);
	return () => destroy(created);
}

export const effect: Effects = Object.assign(post, {
	pre(fn: Body): () => void {
		const created = pre(fn);
		return () => destroy(created);
	},
	root: effectRoot
});

function same(previous: unknown, value: unknown): boolean {
	if (Object.is(previous, value)) return true;
	if (!Array.isArray(previous) || !Array.isArray(value)) return false;
	if (previous.length !== value.length) return false;
	for (let index = 0; index < value.length; index++) {
		if (!Object.is(previous[index], value[index])) return false;
	}
	return true;
}

function watching(name: string, make: (fn: Body) => Effect): Watching {
	return <T>(
		source: () => T,
		changed: (value: T, previous: T | undefined) => void | (() => void),
		options?: WatchOptions<T>
	): (() => void) => {
		if (owner === null) orphan(name);
		const equals = options?.equals ?? same;
		const immediate = options?.immediate === true;
		const value = memo(source, equals);
		let previous: T | undefined = immediate ? undefined : untrack(() => value.current);
		let first = true;
		const created = make(() => {
			const next = value.current;
			const before = previous;
			previous = next;
			if (first) {
				first = false;
				if (!immediate && equals(before as T, next)) return;
			}
			return untrack(() => changed(next, before));
		});
		return () => destroy(created);
	};
}

export const watch: Watch = Object.assign(watching('watch', user), {
	pre: watching('watch.pre', pre)
});

export async function resource<T>(fn: () => T | PromiseLike<T>): Promise<Resource<T>> {
	const value = await asyncDerived(fn);
	return {
		get current() {
			return get(value);
		}
	};
}

export function external<T>(read: () => WritableSource<T> | null | undefined): WritableExternal<T>;
export function external<T>(read: () => Subscribable<T> | null | undefined): External<T>;
export function external<T>(read: () => Subscribable<T> | null | undefined): WritableExternal<T> {
	return expose(connect(read));
}
