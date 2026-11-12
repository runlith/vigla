import { warn } from '../../shared/diagnostics.ts';
import { isPassive } from '../../shared/html.ts';
import { setOwner, untrack } from '../reactivity/tracking.ts';
import { teardown } from '../reactivity/effects.ts';
import { task } from '../reactivity/tasks.ts';
import type { Location } from './meta.ts';

const handlers = Symbol('events');

const handled = Symbol('handled');

interface Registration {
	readonly handler: EventListener | null | undefined;
}

type Handlers = Record<string, Registration | undefined>;

interface Holder {
	[handlers]?: Handlers;
}

interface Dispatched extends Event {
	[handled]?: EventTarget;
}

export function unowned<T>(fn: () => T): T {
	const previous = setOwner(null);
	try {
		return untrack(fn);
	} finally {
		setOwner(previous);
	}
}

export function invoke(
	get: () => unknown,
	target: EventTarget,
	args: [Event, ...unknown[]],
	location: Location,
	sideEffects = false,
	call = false
): void {
	let handler: unknown;
	let failure: unknown;
	let failed = false;
	try {
		handler = get();
	} catch (error) {
		failed = true;
		failure = error;
	}
	if (typeof handler !== 'function' && (sideEffects || handler != null || failed)) {
		const event = args[0];
		const phase = event.eventPhase < 3 ? 'capture' : '';
		const at = `${location.file}:${location.line}:${location.column}`;
		const suggestion = call ? 'remove the trailing `()`' : 'add a leading `() =>`';
		warn(
			'event_handler_invalid',
			`\`${event.type}${phase}\` handler at ${at} should be a function. Did you mean to ${suggestion}?`
		);
	}
	if (failed) throw failure;
	(handler as ((...values: unknown[]) => unknown) | null | undefined)?.apply(target, args);
}

function deferred(type: string): boolean {
	return type.startsWith('pointer') || type.startsWith('touch') || type === 'wheel';
}

export function listen(
	target: EventTarget,
	type: string,
	handler: EventListener,
	capture = false,
	passive?: boolean
): () => void {
	const options: AddEventListenerOptions = { capture, passive };
	let removed = false;
	const wrapped = function (this: EventTarget, event: Event): void {
		if (!capture) propagate.call(target, event);
		if (!event.cancelBubble) unowned(() => handler.call(this, event));
	};
	if (deferred(type)) {
		task(() => {
			if (!removed) target.addEventListener(type, wrapped, options);
		});
	} else {
		target.addEventListener(type, wrapped, options);
	}
	return () => {
		removed = true;
		target.removeEventListener(type, wrapped, options);
	};
}

export function event(
	target: EventTarget,
	type: string,
	handler: EventListener,
	capture = false,
	passive?: boolean
): void {
	teardown(listen(target, type, handler, capture, passive));
}

export function delegated(
	element: EventTarget,
	type: string,
	handler: EventListener | null,
	owned = false
): () => void {
	const holder = element as EventTarget & Holder;
	const events = (holder[handlers] ??= {});
	const registration: Registration = { handler };
	events[type] = registration;
	const remove = (): void => {
		if (events[type] === registration) delete events[type];
	};
	if (owned) teardown(remove);
	return remove;
}

const registered = new Set<string>();

const roots = new Set<(types: readonly string[]) => void>();

export function delegate(...types: string[]): void {
	for (const type of types) registered.add(type);
	for (const root of roots) root(types);
}

const counts = new Map<EventTarget, Map<string, number>>();

export function delegateRoot(target: EventTarget): () => void {
	const own = new Set<string>();
	const add = (types: readonly string[]): void => {
		for (const type of types) {
			if (own.has(type)) continue;
			own.add(type);
			for (const node of [target, document]) {
				let byType = counts.get(node);
				if (byType === undefined) {
					byType = new Map();
					counts.set(node, byType);
				}
				const count = byType.get(type) ?? 0;
				if (count === 0) node.addEventListener(type, propagate, { passive: isPassive(type) });
				byType.set(type, count + 1);
			}
		}
	};
	add([...registered]);
	roots.add(add);
	return () => {
		roots.delete(add);
		for (const type of own) {
			for (const node of [target, document]) {
				const byType = counts.get(node) as Map<string, number>;
				const count = (byType.get(type) as number) - 1;
				if (count === 0) {
					node.removeEventListener(type, propagate);
					byType.delete(type);
					if (byType.size === 0) counts.delete(node);
				} else {
					byType.set(type, count);
				}
			}
		}
	};
}

let last: Event | null = null;

let clearing = false;

function propagate(this: EventTarget, event: Event): void {
	const root = this;
	const dispatched = event as Dispatched;
	const path = event.composedPath();
	let index = 0;
	last = event;
	if (!clearing) {
		clearing = true;
		setTimeout(() => {
			clearing = false;
			last = null;
		});
	}
	const at = last === event ? dispatched[handled] : undefined;
	if (at !== undefined) {
		const atIndex = path.indexOf(at);
		if (atIndex !== -1 && (root === document || root === (window as EventTarget))) {
			dispatched[handled] = root;
			return;
		}
		const rootIndex = path.indexOf(root);
		if (rootIndex === -1) return;
		if (atIndex <= rootIndex) index = atIndex;
	}
	const walk = { index, current: (path[index] ?? event.target) as EventTarget | null };
	if (walk.current === root) return;
	const owner = (root as Node).ownerDocument ?? document;
	Object.defineProperty(event, 'currentTarget', {
		configurable: true,
		get: () => walk.current ?? owner
	});
	const previous = setOwner(null);
	try {
		untrack(() => dispatch(event, path, walk, root));
	} finally {
		dispatched[handled] = root;
		delete (event as unknown as Record<string, unknown>).currentTarget;
		setOwner(previous);
	}
}

interface Walk {
	index: number;
	current: EventTarget | null;
}

function dispatch(event: Event, path: EventTarget[], walk: Walk, root: EventTarget): void {
	let first: unknown = undefined;
	let failed = false;
	const others: unknown[] = [];
	while (walk.current !== null && walk.current !== root) {
		const current = walk.current;
		try {
			const handler = (current as EventTarget & Holder)[handlers]?.[event.type]?.handler;
			if (
				handler != null &&
				(!(current as HTMLButtonElement).disabled || event.target === current)
			) {
				handler.call(current, event);
			}
		} catch (error) {
			if (failed) others.push(error);
			else {
				failed = true;
				first = error;
			}
		}
		if (event.cancelBubble) break;
		walk.index++;
		walk.current = walk.index < path.length ? (path[walk.index] as EventTarget) : null;
	}
	if (failed) {
		for (const error of others) {
			queueMicrotask(() => {
				throw error;
			});
		}
		throw first;
	}
}
