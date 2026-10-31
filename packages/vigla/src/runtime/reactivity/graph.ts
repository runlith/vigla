export const CLEAN = 0;
export const MAYBE = 1;
export const DIRTY = 2;

export const ROOT = 1;
export const BRANCH = 2;
export const BLOCK = 3;
export const TEMPLATE = 4;
export const EFFECT = 5;
export const EAGER = 6;

export type Kind =
	| typeof ROOT
	| typeof BRANCH
	| typeof BLOCK
	| typeof TEMPLATE
	| typeof EFFECT
	| typeof EAGER;

export type Status = typeof CLEAN | typeof MAYBE | typeof DIRTY;

export interface Source<T = unknown> {
	equals?(before: T, after: T): boolean;
	v: T;
	wv: number;
	reactions: Set<Reaction> | null;
	logged: number;
	slot: number;
	read: number;
}

export interface Reaction {
	status: Status;
	deps: Source[] | null;
	rv: number;
}

export interface Derived<T = unknown> extends Source<T>, Reaction {
	readonly fn: () => T;
	readonly owner: Effect | null;
	effects: Effect[] | null;
	computed: boolean;
}

export interface Boundary {
	readonly parent: Boundary | null;
	readonly showing: boolean;
	settle(delta: 1 | -1): void;
	failed(error: unknown): void;
}

export interface Effect extends Reaction {
	readonly kind: Kind;
	boundary: Boundary | null;
	fn: (() => void | (() => void)) | null;
	teardown: (() => void) | null;
	parent: Effect | null;
	first: Effect | null;
	last: Effect | null;
	prev: Effect | null;
	next: Effect | null;
	owned: Derived[] | null;
	units: Set<() => void> | null;
	context: unknown;
	order: number;
	forked: number;
	running: boolean;
	destroyed: boolean;
	inert: boolean;
	pending: boolean;
}

let clock = 0;

export function equal<T>(source: Source<T>, before: T, after: T): boolean {
	return source.equals === undefined ? Object.is(before, after) : source.equals(before, after);
}

export function stamp(): number {
	return ++clock;
}

export function now(): number {
	return clock;
}

export function isDerived(source: Source | Reaction): source is Derived {
	return (source as Derived).fn !== undefined && (source as Effect).kind === undefined;
}

export function isDerivedSource(source: Source): source is Derived {
	return (source as Derived).fn !== undefined;
}

export function isDerivedReaction(reaction: Reaction): reaction is Derived {
	return (reaction as Effect).kind === undefined;
}
