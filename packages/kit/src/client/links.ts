import { DEV } from 'esm-env';
import type { Client } from './client.ts';
import type { Metadata } from './history.ts';
import { preload_data_failed, link_option_invalid, link_option_replaced } from './warnings.ts';

interface Options {
	code: number;
	data: number;
	reload: boolean;
	replace: boolean;
	reset: boolean;
}
const priorities: Record<string, number> = {
	tap: 1,
	hover: 2,
	viewport: 3,
	eager: 4,
	'': 2,
	false: -1
};
const valid: Record<string, string[]> = {
	'preload-code': ['', 'false', 'tap', 'hover', 'viewport', 'eager'],
	'preload-data': ['', 'false', 'tap', 'hover'],
	reload: ['', 'true', 'false'],
	replacestate: ['', 'true', 'false'],
	reset: ['', 'true', 'false']
};
const warned = new WeakSet<Element>();

function parent(element: Element): Element | null {
	const node = element.assignedSlot ?? element.parentNode;
	return node instanceof ShadowRoot ? node.host : node instanceof Element ? node : null;
}

function anchor(event: Event, container: Element): Element | null {
	if (!event.composedPath().includes(container)) return null;
	let element =
		event.composedPath().find((node): node is Element => node instanceof Element) ?? null;
	while (element && element !== container) {
		if (element.localName === 'a' && element.hasAttribute('href')) return element;
		element = parent(element);
	}
	return null;
}

function options(element: Element): Options {
	const values: Record<string, string> = {};
	for (let node: Element | null = element; node; node = parent(node)) {
		for (const [name, accepted] of Object.entries(valid)) {
			const value = node.getAttribute(`data-sveltekit-${name}`);
			if (value === null || name in values) continue;
			if (accepted.includes(value)) values[name] = value;
			else if (DEV && !warned.has(node)) {
				warned.add(node);
				link_option_invalid({
					name,
					options: accepted.map((value) => JSON.stringify(value)).join(', ')
				});
			}
		}
		if (DEV && !warned.has(node)) {
			for (const name of ['noscroll', 'keepfocus'])
				if (node.hasAttribute(`data-sveltekit-${name}`)) {
					warned.add(node);
					link_option_replaced({ name });
				}
		}
	}
	return {
		code: priorities[values['preload-code'] ?? 'false'] ?? -1,
		data: priorities[values['preload-data'] ?? 'false'] ?? -1,
		reload: 'reload' in values && values.reload !== 'false',
		replace: 'replacestate' in values && values.replacestate !== 'false',
		reset: values.reset !== 'false'
	};
}

export function listen(client: Client): () => void {
	const abort = new AbortController();
	const container = client.container;
	let hover: ReturnType<typeof setTimeout> | undefined;
	let fragment: { source: Metadata; reset: boolean } | undefined;
	const listener = <K extends keyof WindowEventMap>(
		target: Window,
		name: K,
		callback: (event: WindowEventMap[K]) => void
	) => target.addEventListener(name, callback, { signal: abort.signal });
	function info(
		element: Element
	): { url: URL; options: Options; external: boolean; ignore: boolean } | null {
		const href = element.getAttribute('href');
		if (href === null) return null;
		let url: URL;
		try {
			url = client.url(href);
		} catch {
			return null;
		}
		if (client.routes.hash && url.hash && !url.hash.startsWith('#/'))
			url.hash = `${location.hash.split('#')[1] ?? '/'}${url.hash}`;
		const target = element.getAttribute('target') || document.querySelector('base')?.target;
		const ignore = (!!target && target !== '_self') || element.hasAttribute('download');
		const external =
			client.routes.outside(url) ||
			(element.getAttribute('rel') ?? '').split(/\s+/).includes('external');
		return { url, options: options(element), external, ignore };
	}
	function preload(element: Element, priority: number): void {
		if ('connection' in navigator && (navigator.connection as { saveData?: boolean }).saveData)
			return;
		const link = info(element);
		if (!link || link.ignore || link.external || link.options.reload) return;
		if (link.options.data >= priority) {
			void client.preloadData(link.url).catch((error: unknown) => {
				if (DEV) preload_data_failed({ path: link.url.href, message: String(error) });
			});
		} else if (link.options.code >= priority) {
			void client
				.intent(link.url)
				.then((intent) => intent && client.routes.preload(intent.route.id))
				.catch(() => {});
		}
	}
	listener(window, 'click', (event) => {
		if (
			event.button ||
			event.metaKey ||
			event.ctrlKey ||
			event.shiftKey ||
			event.altKey ||
			event.defaultPrevented
		)
			return;
		const element = anchor(event, container);
		if (!element) return;
		const link = info(element);
		if (!link || link.ignore) return;
		const same = client.routes.key(link.url) === client.routes.key(new URL(location.href));
		const hasHash = (client.routes.hash ? link.url.hash.slice(1) : link.url.href).includes('#');
		if (!link.external && same && hasHash && !link.options.replace) {
			client.restoration.capture(client.history.index, client.view.components);
			if (link.url.href === location.href) {
				event.preventDefault();
				client.restoration.scroll(link.url, true);
				client.restoration.focus(link.url);
			} else {
				fragment = { source: client.history.current, reset: link.options.reset };
				client.updateUrl(link.url);
			}
			return;
		}
		if (link.external || link.options.reload) {
			if (!client.leave(link.url, event)) event.preventDefault();
			return;
		}
		event.preventDefault();
		void client
			.navigate(link.url, {
				type: 'link',
				event,
				replace: link.options.replace || link.url.href === location.href,
				refreshAll: link.url.href === location.href,
				reset: link.options.reset
			})
			.catch(console.error);
	});
	listener(window, 'pointermove', (event) => {
		clearTimeout(hover);
		const element = anchor(event, container);
		if (element) hover = setTimeout(() => preload(element, 2), 20);
	});
	listener(window, 'pointerdown', (event) => {
		const element = anchor(event, container);
		if (element) preload(element, 1);
	});
	listener(window, 'touchstart', (event) => {
		const element = anchor(event, container);
		if (element) preload(element, 1);
	});
	listener(window, 'pageshow', () => {
		client.unloading = false;
		client.state.navigation.current = null;
	});
	listener(window, 'popstate', (event) => {
		const url = new URL(location.href);
		const metadata = client.history.metadata(event.state);
		if (!metadata) {
			if (!fragment) {
				if (client.routes.hash) location.reload();
				else client.updateUrl(url);
			}
			return;
		}
		if (metadata.historyIndex === client.history.index) return;
		const source = client.history.current;
		const delta = metadata.historyIndex - source.historyIndex;
		const reset = metadata.resetIndex !== source.resetIndex;
		const hash =
			!!client.current &&
			(url.hash !== '' || client.current.url.hash !== '') &&
			client.routes.key(url) === client.routes.key(client.current.url);
		const shallow =
			metadata.navigationIndex === client.history.navigation &&
			(hash ||
				(client.navigated &&
					(metadata.pageUrl === undefined || metadata.pageUrl === location.href)));
		client.restoration.capture(client.history.index, client.view.components);
		client.history.accept(metadata);
		void client
			.navigate(new URL(location.href), {
				type: 'popstate',
				event,
				delta,
				popped: metadata,
				source,
				reset,
				shallow
			})
			.catch(console.error);
	});
	listener(window, 'hashchange', () => {
		const url = new URL(location.href);
		if (fragment) {
			client.history.fragment(url, fragment.source, fragment.reset);
			client.restoration.clear(client.history.index);
			fragment = undefined;
		} else if (
			!client.routes.hash &&
			client.routes.key(url) === client.routes.key(client.current?.url ?? url)
		)
			client.updateUrl(url);
	});
	listener(window, 'beforeunload', (event) => {
		client.restoration.capture(client.history.index, client.view.components);
		client.restoration.persist();
		if (
			!client.unloading &&
			!client.lifecycle.allow(
				client.navigation(null, 'leave') as import('../types/navigation.ts').Navigation
			)
		) {
			event.preventDefault();
			event.returnValue = '';
		}
	});
	listener(window, 'pagehide', () => {
		client.restoration.capture(client.history.index, client.view.components);
		client.restoration.persist();
	});
	listener(window, 'focus', () => {
		if (document.visibilityState === 'visible') void client.state.check();
	});
	document.addEventListener(
		'visibilitychange',
		() => {
			if (document.visibilityState === 'visible') void client.state.check();
		},
		{ signal: abort.signal }
	);
	listener(window, 'submit', (event) => {
		if (
			event.defaultPrevented ||
			!(event.target instanceof HTMLFormElement) ||
			!event.composedPath().includes(container)
		)
			return;
		const form = event.target;
		const copy = HTMLFormElement.prototype.cloneNode.call(form) as HTMLFormElement;
		const submitter = event.submitter as HTMLButtonElement | HTMLInputElement | null;
		const method = submitter?.hasAttribute('formmethod') ? submitter.formMethod : copy.method;
		const target = submitter?.hasAttribute('formtarget') ? submitter.formTarget : copy.target;
		if (method !== 'get' || (target && target !== '_self')) return;
		const url = client.url(
			submitter?.hasAttribute('formaction') ? submitter.formAction : copy.action
		);
		const config = options(form);
		if (client.routes.outside(url) || config.reload) return;
		const data = new FormData(form, submitter);
		url.search = '';
		for (const [name, value] of data)
			url.searchParams.append(name, typeof value === 'string' ? value : value.name);
		event.preventDefault();
		void client
			.navigate(url, { type: 'form', event, replace: config.replace, reset: config.reset })
			.catch(console.error);
	});
	const observer =
		typeof IntersectionObserver === 'undefined'
			? undefined
			: new IntersectionObserver((entries) => {
					for (const entry of entries)
						if (entry.isIntersecting) {
							preload(entry.target, 3);
							observer?.unobserve(entry.target);
						}
				});
	function anchors(root: Element): Element[] {
		return [...(root.matches('a[href]') ? [root] : []), ...root.querySelectorAll('a[href]')];
	}
	function scan(root: Element): void {
		for (const element of anchors(root)) {
			const config = options(element);
			if (config.code === 4) preload(element, 4);
			if (config.code === 3) observer?.observe(element);
			else observer?.unobserve(element);
		}
	}
	const mutations = new MutationObserver((records) => {
		for (const record of records) {
			if (record.type === 'attributes' && record.target instanceof Element) scan(record.target);
			for (const node of record.addedNodes) if (node instanceof Element) scan(node);
			for (const node of record.removedNodes)
				if (node instanceof Element)
					for (const element of anchors(node)) observer?.unobserve(element);
		}
	});
	mutations.observe(container, {
		childList: true,
		subtree: true,
		attributes: true,
		attributeFilter: [
			'href',
			'data-sveltekit-preload-code',
			'data-sveltekit-preload-data',
			'data-sveltekit-reload'
		]
	});
	scan(container);
	for (const link of document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]'))
		link.href = link.href;
	return () => {
		clearTimeout(hover);
		abort.abort();
		observer?.disconnect();
		mutations.disconnect();
	};
}
