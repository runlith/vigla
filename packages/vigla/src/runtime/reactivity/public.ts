import {
	expose,
	type External,
	type Subscribable,
	type WritableExternal,
	type WritableSource
} from '../../shared/external.ts';
import { asyncDerived } from './async.ts';
import { destroy, effect as user, effectRoot, pre } from './effects.ts';
import { external as connect } from './external.ts';
import { get } from './tracking.ts';

type Body = () => void | (() => void);

export interface Effects {
	(fn: Body): () => void;
	pre(fn: Body): () => void;
	root(fn: Body): () => void;
}

export interface Resource<T> {
	readonly current: T;
}

function watch(fn: Body): () => void {
	const created = user(fn);
	return () => destroy(created);
}

export const effect: Effects = Object.assign(watch, {
	pre(fn: Body): () => void {
		const created = pre(fn);
		return () => destroy(created);
	},
	root: effectRoot
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
