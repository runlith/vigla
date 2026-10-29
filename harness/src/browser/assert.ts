export function ok(condition: unknown, message?: string): asserts condition {
	if (!condition) throw new Error(message || `Expected ${String(condition)} to be truthy`);
}

function same(a: unknown, b: unknown): boolean {
	if (a && typeof a === 'object') {
		const array = Array.isArray(a);
		if (Array.isArray(b) !== array) return false;
		if (array) {
			const other = b as unknown[];
			return a.length === other.length && a.every((value, i) => same(value, other[i]));
		}
		const left = a as Record<string, unknown>;
		const right = b as Record<string, unknown>;
		const keys = Object.keys(left).sort();
		if (keys.join(',') !== Object.keys(right).sort().join(',')) return false;
		return keys.every((key) => same(left[key], right[key]));
	}
	return a === b;
}

export function deepEqual(a: unknown, b: unknown, message?: string): void {
	if (!same(a, b))
		throw new Error(message || `Expected ${JSON.stringify(a)} to equal ${JSON.stringify(b)}`);
}

export function equal(a: unknown, b: unknown, message?: string): void {
	if (a != b) throw new Error(message || `Expected ${String(a)} to equal ${String(b)}`);
}

function children(node: Element): void {
	const attributes = [...node.attributes].sort((a, b) => (a.name < b.name ? -1 : 1));
	for (const attribute of attributes) node.removeAttribute(attribute.name);
	for (const attribute of attributes) node.setAttribute(attribute.name, attribute.value);
	if (node.hasAttribute('style')) {
		const styled = node as HTMLElement;
		styled.setAttribute('style', styled.style.cssText);
	}
	for (const child of [...node.childNodes]) {
		if (child.nodeType === Node.ELEMENT_NODE) children(child as Element);
	}
}

function normalize(html: string): string {
	try {
		const node = document.createElement('div');
		node.innerHTML = html
			.replace(/<!--.*?-->/g, '')
			.replace(/>[\s\r\n]+</g, '><')
			.replace(/svelte-\w+/g, 'svelte-xyz123')
			.trim();
		children(node);
		return node.innerHTML.replace(/<\/?noscript\/?>/g, '');
	} catch {
		throw new Error(`Failed to normalize HTML:\n${html}`);
	}
}

export function htmlEqual(actual: string, expected: string, message?: string): void {
	deepEqual(normalize(actual), normalize(expected), message);
}
