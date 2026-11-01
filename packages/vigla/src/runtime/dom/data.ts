import { DEV } from 'esm-env';
import { failure, warn } from '../../shared/diagnostics.ts';
import { format as nativeFormat, type Format } from '../../shared/format.ts';
import type { Effect } from '../reactivity/graph.ts';
import { teardown } from '../reactivity/effects.ts';
import { owner } from '../reactivity/tracking.ts';
import { hydrating } from './hydration.ts';

interface Input {
	readonly values: Map<string, unknown> | undefined;
	readonly explicit: boolean;
}

interface Global {
	h?: Map<string, unknown>;
}

interface Published {
	readonly values: Map<string, unknown>;
	users: number;
}

const inputs = new WeakMap<Effect, Input>();
const published = new WeakMap<Window, Map<string, Published>>();

function acquire(view: Window, key: string, values: Map<string, unknown>): () => void {
	let stores = published.get(view);
	if (stores === undefined) published.set(view, (stores = new Map()));
	let store = stores.get(key);
	if (store === undefined || store.values !== values) {
		store = { values, users: 0 };
		stores.set(key, store);
	}
	const retained = store;
	store.users++;
	let active = true;
	return () => {
		if (!active) return;
		active = false;
		if (--retained.users !== 0) return;
		if (stores.get(key) === retained) stores.delete(key);
		const globals = view as unknown as Record<string, Global | undefined>;
		const global = globals[key];
		if (global?.h === values) delete global.h;
	};
}

function viewOf(target: ParentNode | undefined): Window {
	if (target === undefined) return window;
	const document =
		(target as Node).nodeType === 9 ? (target as Document) : (target as Node).ownerDocument;
	return document?.defaultView ?? window;
}

function serverData(view: Window, format: Format): Map<string, unknown> | undefined {
	return (view as unknown as Record<string, Global | undefined>)[format.global]?.h;
}

export interface HydrationOptions {
	readonly format?: Format;
	readonly target?: ParentNode;
	readonly beforeSnapshot?: () => void;
}

export function openHydration(options: HydrationOptions = {}): () => void {
	if (owner === null) {
		throw failure(
			'context_without_owner',
			'Hydration data can only be opened where an owner exists'
		);
	}
	const view = viewOf(options.target);
	const format = options.format ?? nativeFormat;
	const values = serverData(view, format);
	if (values === undefined) return () => {};
	const at = owner;
	const input: Input = { values, explicit: true };
	inputs.set(at, input);
	const releaseStore = acquire(view, format.global, values);
	let open = true;
	return () => {
		if (!open) return;
		open = false;
		if (inputs.get(at) === input) inputs.delete(at);
		releaseStore();
	};
}

export function withHydration<T>(format: Format, target: ParentNode, fn: () => T): T {
	if (owner === null) return fn();
	const view = viewOf(target);
	const values = hydrating ? serverData(view, format) : undefined;
	const at = owner;
	inputs.set(at, { values, explicit: false });
	if (values === undefined) return fn();
	const releaseStore = acquire(view, format.global, values);
	const release = (): void => {
		inputs.delete(at);
		releaseStore();
	};
	teardown(release);
	try {
		return fn();
	} catch (error) {
		release();
		throw error;
	}
}

function nearest(): Input | undefined {
	for (let at = owner; at !== null; at = at.parent) {
		const input = inputs.get(at);
		if (input !== undefined && (input.explicit || hydrating)) return input;
	}
	return undefined;
}

export function hydratable<T>(key: string, fn: () => T): T {
	const input = nearest();
	if (input === undefined) return fn();
	if (input.values?.has(key)) return input.values.get(key) as T;
	const message = `The hydratable key ${JSON.stringify(key)} was not present in the server render`;
	if (DEV) throw failure('hydratable_missing_but_required', message);
	warn('hydratable_missing_but_expected', message);
	return fn();
}

export function hydrated<T>(key: string, fn: () => T): T {
	const values = nearest()?.values;
	return values?.has(key) ? (values.get(key) as T) : fn();
}
