export const CLEAN = 0;
export const MAYBE = 1;
export const DIRTY = 2;

export const ROOT = 1;
export const BRANCH = 2;
export const BLOCK = 3;
export const TEMPLATE = 4;
export const EFFECT = 5;

export type Kind = typeof ROOT | typeof BRANCH | typeof BLOCK | typeof TEMPLATE | typeof EFFECT;

export type Status = typeof CLEAN | typeof MAYBE | typeof DIRTY;

export interface Source<T = unknown> {
	v: T;
	wv: number;
	reactions: Set<Reaction> | null;
}

export interface Reaction {
	status: Status;
	deps: Source[] | null;
	rv: number;
}

export interface Derived<T = unknown> extends Source<T>, Reaction {
	readonly fn: () => T;
	readonly owner: Effect | null;
	computed: boolean;
}

export interface Effect extends Reaction {
	readonly kind: Kind;
	fn: (() => void | (() => void)) | null;
	teardown: (() => void) | null;
	parent: Effect | null;
	first: Effect | null;
	last: Effect | null;
	prev: Effect | null;
	next: Effect | null;
	owned: Derived[] | null;
	context: unknown;
	order: number;
	running: boolean;
	destroyed: boolean;
	inert: boolean;
	pending: boolean;
}

let clock = 0;

export function stamp(): number {
	return ++clock;
}

export function now(): number {
	return clock;
}

export function isDerived(source: Source | Reaction): source is Derived {
	return (source as Derived).fn !== undefined && (source as Effect).kind === undefined;
}
