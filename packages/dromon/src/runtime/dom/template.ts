export type Render = (anchor: ChildNode) => void;

export function fragment(html: string): () => DocumentFragment {
	let template: HTMLTemplateElement | null = null;
	return () => {
		if (template === null) {
			template = document.createElement('template');
			template.innerHTML = html;
		}
		return template.content.cloneNode(true) as DocumentFragment;
	};
}

export function child(node: Node): ChildNode {
	return node.firstChild as ChildNode;
}

export function sibling(node: ChildNode, count = 1): ChildNode {
	let found = node;
	for (let step = 0; step < count; step++) found = found.nextSibling as ChildNode;
	return found;
}

export function append(anchor: ChildNode, node: Node): void {
	anchor.before(node);
}

export function text(node: Text, value: unknown): void {
	const next = value == null ? '' : String(value);
	if (node.nodeValue !== next) node.nodeValue = next;
}

export function on(node: EventTarget, type: string, handler: EventListener): void {
	node.addEventListener(type, handler);
}
