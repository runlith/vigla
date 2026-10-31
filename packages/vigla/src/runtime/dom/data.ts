import { DEV } from 'esm-env';
import { failure, warn } from '../../shared/diagnostics.ts';
import type { Format } from '../../shared/format.ts';
import type { Effect } from '../reactivity/graph.ts';
import { teardown } from '../reactivity/effects.ts';
import { owner } from '../reactivity/tracking.ts';
import { hydrating } from './hydration.ts';

interface Input {
	readonly values: Map<string, unknown> | undefined;
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

export function withHydration<T>(format: Format, target: ParentNode, fn: () => T): T {
	if (owner === null) return fn();
	const document =
		(target as Node).nodeType === 9 ? (target as Document) : (target as Node).ownerDocument;
	const view = document?.defaultView ?? window;
	const globals = view as unknown as Record<string, Global | undefined>;
	const values = hydrating ? globals[format.global]?.h : undefined;
	const at = owner;
	inputs.set(at, { values });
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

export function hydratable<T>(key: string, fn: () => T): T {
	if (!hydrating) return fn();
	for (let at = owner; at !== null; at = at.parent) {
		const input = inputs.get(at);
		if (input === undefined) continue;
		if (input.values?.has(key)) return input.values.get(key) as T;
		const message = `The hydratable key ${JSON.stringify(key)} was not present in the server render`;
		if (DEV) throw failure('hydratable_missing_but_required', message);
		warn('hydratable_missing_but_expected', message);
		break;
	}
	return fn();
}
