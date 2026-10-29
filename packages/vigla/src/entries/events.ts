import { listen } from '../runtime/dom/events.ts';

export function on(
	element: EventTarget,
	type: string,
	handler: EventListener,
	options: AddEventListenerOptions = {}
): () => void {
	return listen(element, type, handler, options.capture ?? false, options.passive);
}
