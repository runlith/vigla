import { parse, parseFragment, type DefaultTreeAdapterTypes } from 'parse5';

export interface CrawlResult {
	ids: string[];
	hrefs: string[];
	invalid: string[];
}
const metaNames = new Set([
	'og:url',
	'og:image',
	'og:image:url',
	'og:image:secure_url',
	'og:video',
	'og:video:url',
	'og:video:secure_url',
	'og:audio',
	'og:audio:url',
	'og:audio:secure_url',
	'twitter:image'
]);
const internalOrigin = 'http://sveltekit.invalid';

export function decode(text: string): string {
	const fragment = parseFragment(text.replaceAll('<', '&lt;'));
	return fragment.childNodes
		.map((node) => (node.nodeName === '#text' && 'value' in node ? node.value : ''))
		.join('');
}

function candidates(value: string): string[] {
	const urls: string[] = [];
	let offset = 0;
	while (offset < value.length) {
		while (/[\s,]/.test(value[offset] ?? '') && offset < value.length) offset++;
		const start = offset;
		while (offset < value.length && !/\s/.test(value[offset]!)) offset++;
		const token = value.slice(start, offset);
		if (!token) break;
		urls.push(token.replace(/,+$/, ''));
		if (token.endsWith(',')) continue;
		let parentheses = 0;
		while (offset < value.length) {
			const char = value[offset++]!;
			if (char === '(') parentheses++;
			if (char === ')') parentheses--;
			if (char === ',' && !parentheses) break;
		}
	}
	return urls;
}

export function crawl(html: string, base: string): CrawlResult {
	const result: CrawlResult = { ids: [], hrefs: [], invalid: [] };
	const elements: DefaultTreeAdapterTypes.Element[] = [];
	function visit(node: DefaultTreeAdapterTypes.Node): void {
		if ('tagName' in node) {
			if (node.tagName === 'script' || node.tagName === 'style') return;
			if (node.sourceCodeLocation) elements.push(node);
			if (node.tagName === 'template') visit((node as DefaultTreeAdapterTypes.Template).content);
		}
		if ('childNodes' in node) node.childNodes.forEach(visit);
	}
	visit(parse(html, { sourceCodeLocationInfo: true }));
	elements.sort((a, b) => a.sourceCodeLocation!.startOffset - b.sourceCodeLocation!.startOffset);
	let currentBase = new URL(base, internalOrigin);
	const resolve = (value: string) => {
		if (value.startsWith('//')) return value;
		const url = new URL(value, currentBase);
		return url.origin === internalOrigin ? url.pathname + url.search + url.hash : url.href;
	};
	const push = (value: string) => {
		try {
			result.hrefs.push(resolve(value));
		} catch {
			result.invalid.push(value);
		}
	};
	for (const element of elements) {
		const attrs = Object.fromEntries(element.attrs.map(({ name, value }) => [name, value]));
		if (attrs.href) {
			if (element.tagName === 'base') {
				try {
					currentBase = new URL(attrs.href, currentBase);
				} catch {
					result.invalid.push(attrs.href);
				}
			} else if (!/\bexternal\b/i.test(attrs.rel ?? '')) push(attrs.href);
		}
		if (attrs.id) result.ids.push(decodeURI(attrs.id));
		if (attrs.name && element.tagName === 'a') result.ids.push(decodeURI(attrs.name));
		if (attrs.src) push(attrs.src);
		if (attrs.srcset) candidates(attrs.srcset).forEach(push);
		if (
			element.tagName === 'meta' &&
			attrs.content &&
			metaNames.has(attrs.name ?? attrs.property ?? '')
		)
			push(attrs.content);
	}
	return result;
}
