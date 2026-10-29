import { effect, teardown, template } from '../reactivity/effects.ts';
import { setOwner, untrack } from '../reactivity/tracking.ts';
import { listen } from './events.ts';

type Get<T> = () => T;
type Set<T> = (value: T) => void;

function detached<T>(fn: () => T): T {
	const previous = setOwner(null);
	try {
		return untrack(fn);
	} finally {
		setOwner(previous);
	}
}

export function on(
	target: EventTarget,
	type: string,
	handler: EventListener,
	capture = false,
	passive?: boolean
): void {
	const remove = listen(target, type, handler, capture, passive);
	teardown(remove);
}

function watch(target: EventTarget, types: readonly string[], handler: () => void): void {
	handler();
	for (const type of types) target.addEventListener(type, handler);
	teardown(() => {
		for (const type of types) target.removeEventListener(type, handler);
	});
}

export function bindWindowSize(
	name: 'innerWidth' | 'innerHeight' | 'outerWidth' | 'outerHeight',
	set: Set<number>
): void {
	watch(window, ['resize'], () => detached(() => set(window[name])));
}

export function bindOnline(set: Set<boolean>): void {
	watch(window, ['online', 'offline'], () => detached(() => set(navigator.onLine)));
}

export function bindActiveElement(set: Set<Element | null>): void {
	const handler = (event?: Event): void => {
		if (event?.type === 'focusout' && (event as FocusEvent).relatedTarget) return;
		detached(() => set(document.activeElement));
	};
	handler();
	document.addEventListener('focusin', handler);
	document.addEventListener('focusout', handler);
	teardown(() => {
		document.removeEventListener('focusin', handler);
		document.removeEventListener('focusout', handler);
	});
}

export function bindWindowScroll(axis: 'x' | 'y', get: Get<number>, set: Set<number> = get): void {
	const horizontal = axis === 'x';
	let scrolling = false;
	let timeout: ReturnType<typeof setTimeout> | undefined;
	const settle = (): void => {
		scrolling = false;
	};
	const hold = (): void => {
		scrolling = true;
		clearTimeout(timeout);
		timeout = setTimeout(settle, 100);
	};
	const handler = (): void =>
		detached(() => {
			hold();
			set(horizontal ? window.scrollX : window.scrollY);
		});
	window.addEventListener('scroll', handler, { passive: true });
	let first = true;
	template(() => {
		const value = get();
		if (first) {
			first = false;
			return;
		}
		if (scrolling || value == null) return;
		hold();
		if (horizontal) window.scrollTo(value, window.scrollY);
		else window.scrollTo(window.scrollX, value);
	});
	effect(handler);
	teardown(() => {
		clearTimeout(timeout);
		window.removeEventListener('scroll', handler);
	});
}
