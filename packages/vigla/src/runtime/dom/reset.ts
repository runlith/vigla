import { namespaces } from '../../shared/html.ts';
import { task } from '../reactivity/tasks.ts';
import { unowned } from './events.ts';

type Reset = () => void;

const callbacks = new WeakMap<Element, Set<Reset>>();
const documents = new WeakSet<Document>();

function reset(event: Event): void {
	const form = event.target as HTMLFormElement | null;
	if (form?.namespaceURI !== namespaces.html || form.localName !== 'form') return;
	task(() => {
		if (event.defaultPrevented) return;
		unowned(() => {
			for (const element of form.elements) {
				for (const callback of callbacks.get(element) ?? []) callback();
			}
		});
	});
}

export function onReset(element: Element, fn: Reset): () => void {
	let handlers = callbacks.get(element);
	if (handlers === undefined) {
		handlers = new Set();
		callbacks.set(element, handlers);
	}
	const callback = (): void => fn();
	handlers.add(callback);
	const document = element.ownerDocument;
	if (!documents.has(document)) {
		documents.add(document);
		document.addEventListener('reset', reset, { capture: true });
	}
	return () => {
		if (handlers.delete(callback) && handlers.size === 0) callbacks.delete(element);
	};
}
