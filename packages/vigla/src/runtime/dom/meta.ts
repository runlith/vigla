import { detached } from '../reactivity/effects.ts';
import type { Effect } from '../reactivity/graph.ts';
import { owner, setOwner } from '../reactivity/tracking.ts';

export interface Location {
	readonly file: string;
	readonly line: number;
	readonly column: number;
}

export interface FrameInput extends Location {
	readonly type: string;
	readonly componentTag?: string;
}

interface Frame extends FrameInput {
	readonly parent: Frame | null;
}

const frames = new WeakMap<Effect, Frame>();
const components = new WeakMap<object, string>();

export function componentSource(component: object, file: string): void {
	components.set(component, file);
}

export function componentFile(component: object): string {
	return components.get(component) ?? '(unknown)';
}

export function callerFile(): string | null {
	for (let frame = current(); frame !== null; frame = frame.parent) {
		if (frame.type === 'component') return frame.file;
	}
	return null;
}

function current(): Frame | null {
	for (let at = owner; at !== null; at = at.parent) {
		const frame = frames.get(at);
		if (frame !== undefined) return frame;
	}
	return null;
}

export function frame<T>(source: FrameInput, fn: () => T): T {
	const parent = current();
	const previous = owner;
	const scope = detached(null, previous);
	frames.set(scope, { ...source, parent });
	setOwner(scope);
	try {
		return fn();
	} finally {
		setOwner(previous);
	}
}

export function locate(element: Element, key: string, loc: Location): void {
	(element as unknown as Record<string, unknown>)[key] = { parent: current(), loc };
}

export function disclose(key: string, version: string): void {
	if (typeof window === 'undefined') return;
	const target = window as unknown as Record<string, { v?: Set<string> }>;
	((target[key] ??= {}).v ??= new Set()).add(version);
}
