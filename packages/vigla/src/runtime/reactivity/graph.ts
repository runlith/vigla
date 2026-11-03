export const CLEAN = 0;
export const MAYBE = 1;
export const DIRTY = 2;

export const ROOT = 1;
export const BRANCH = 2;
export const BLOCK = 3;
export const TEMPLATE = 4;
export const EFFECT = 5;
export const EAGER = 6;

export const SOURCE = 0;
export const DERIVED = 7;

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
	readonly kind: typeof SOURCE | typeof DERIVED;
	v: T;
	wv: number;
	reactions: Reaction[] | null;
	logged: number;
	slot: number;
	read: number;
	links: number[] | null;
}

export interface Captured {
	readonly values: ReadonlyMap<Source, unknown>;
	readonly viewed: boolean;
}

export interface Reaction {
	status: Status;
	deps: Source[] | null;
	rv: number;
	slots: number[] | null;
	captured: Captured | null;
}

export interface Failure {
	readonly error: unknown;
}

const retaining = new WeakSet<Derived>();

export function retainFailures(derived: Derived): void {
	retaining.add(derived);
}

export function retainsFailures(derived: Derived): boolean {
	return retaining.has(derived);
}

export interface Derived<T = unknown> extends Source<T>, Reaction {
	readonly kind: typeof DERIVED;
	readonly fn: () => T;
	readonly owner: Effect | null;
	effects: Effect[] | null;
	frozen: Effect[] | null;
	failure: Failure | null;
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
	batch: number;
	forked: boolean;
	async: boolean;
	running: boolean;
	destroyed: boolean;
	inert: boolean;
	pending: boolean;
	scope: boolean;
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

export function isDerived(node: Source | Reaction): node is Derived {
	return (node as Source | Effect).kind === DERIVED;
}

export function application(effect: Effect): Effect {
	let top = effect;
	while (top.parent !== null) top = top.parent;
	return top;
}
