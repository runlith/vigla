import { attachment, type Attachment } from '../runtime/dom/attachments.ts';
import { teardown, template } from '../runtime/reactivity/effects.ts';
import { untrack } from '../runtime/reactivity/tracking.ts';
import type { Action, ActionReturn } from './action.ts';

export type { Attachment };

export function createAttachmentKey(): symbol {
	return attachment();
}

export function fromAction<E extends Element, P>(
	action: Action<E, P> | ((element: E, parameter: P) => void | ActionReturn<P>),
	fn: () => P = (() => undefined) as () => P
): Attachment<E> {
	return (element) => {
		const { update, destroy } = untrack(
			() => (action as (element: E, parameter: P) => void | ActionReturn<P>)(element, fn()) ?? {}
		);
		if (update !== undefined) {
			let ran = false;
			template(() => {
				const parameter = fn();
				if (ran) update(parameter);
			});
			ran = true;
		}
		if (destroy !== undefined) teardown(destroy);
	};
}
