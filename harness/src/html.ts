import { assert } from 'vitest';

const ELEMENT = 1;
const TEXT = 3;
const COMMENT = 8;
const SVG = 'http://www.w3.org/2000/svg';

interface Options {
	preserveComments: boolean;
}

function attributes(node: Element): void {
	const sorted = [...node.attributes].sort((a, b) => (a.name < b.name ? -1 : 1));
	for (const attribute of sorted) {
		if (attribute.name !== 'xmlns') node.removeAttribute(attribute.name);
	}
	for (const { name, value } of sorted) {
		if (['onload', 'onerror', 'xmlns'].includes(name) && value === 'this.__e=event') continue;
		node.setAttribute(
			name,
			name === 'class' ? value.replace(/svelte-\w+/, 'svelte-xyz123') : value
		);
	}
}

function clean(element: Element, options: Options): void {
	const template =
		element.nodeName.toUpperCase() === 'TEMPLATE' ? (element as HTMLTemplateElement) : undefined;
	let node = element;
	if (template !== undefined) {
		node = document.createElement('div');
		node.append(template.content);
	}

	attributes(node);

	let previous: ChildNode | null = null;
	let nested = false;

	for (let child of [...node.childNodes]) {
		if (child.nodeType === TEXT) {
			let text = child as Text;
			if (node.namespaceURI === SVG && node.tagName !== 'text' && node.tagName !== 'tspan') {
				node.removeChild(child);
				continue;
			}
			text.data = text.data.replace(/[^\S]+/g, ' ');
			if (previous !== null && previous.nodeType === TEXT) {
				const merged = previous as Text;
				merged.data += text.data;
				node.removeChild(text);
				text = merged;
				text.data = text.data.replace(/[^\S]+/g, ' ');
				continue;
			}
		}

		if (child.nodeType === COMMENT && !options.preserveComments) {
			child.remove();
			continue;
		}

		if (child.nodeType === ELEMENT || child.nodeType === COMMENT) {
			if (previous?.nodeType === TEXT) {
				const text = previous as Text;
				text.data = text.data.replace(/^[^\S]+$/, '\n');
			} else if (previous?.nodeType === ELEMENT || previous?.nodeType === COMMENT) {
				node.insertBefore(document.createTextNode('\n'), child);
			}
			if (child.nodeType === ELEMENT) {
				nested = true;
				clean(child as Element, options);
			}
		}

		previous = child;
	}

	if (node.firstChild !== null && node.firstChild.nodeType === TEXT) {
		const text = node.firstChild as Text;
		text.data = text.data.trimStart();
	}
	if (node.lastChild !== null && node.lastChild.nodeType === TEXT) {
		const text = node.lastChild as Text;
		text.data = text.data.trimEnd();
	}

	if (nested && node.parentNode !== null) {
		node.innerHTML = `\n  ${node.innerHTML.replace(/\n/g, '\n  ')}\n`;
	}

	if (template !== undefined) template.innerHTML = node.innerHTML;
}

export function normalize(html: string, preserveComments = false): string {
	try {
		const node = document.createElement('div');
		node.innerHTML = html.trim();
		clean(node, { preserveComments });
		return node.innerHTML;
	} catch (error) {
		throw new Error(`Failed to normalize HTML:\n${html}\nCause: ${String(error)}`);
	}
}

function raw(html: string, preserveComments: boolean | undefined): string {
	return html
		.trim()
		.replace(/\r\n/g, '\n')
		.replace(/(<!(--)?.*?\2>)/g, preserveComments !== false ? '$1' : '');
}

export function htmlEqual(actual: string, expected: string, message?: string): void {
	assert.deepEqual(normalize(actual), normalize(expected), message);
}

export interface HtmlOptions {
	preserveComments?: boolean | undefined;
	withoutNormalizeHtml?: boolean | undefined;
}

export function htmlEqualWithOptions(
	actual: string,
	expected: string,
	options: HtmlOptions,
	message?: string
): void {
	const { preserveComments, withoutNormalizeHtml } = options;
	if (withoutNormalizeHtml) {
		assert.deepEqual(raw(actual, preserveComments), raw(expected, preserveComments), message);
	} else {
		assert.deepEqual(
			normalize(actual.trim(), preserveComments),
			normalize(expected.trim(), preserveComments),
			message
		);
	}
}
