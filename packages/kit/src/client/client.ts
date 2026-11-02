import { createContext, onDestroy, openHydration, root, untrack, type Owner } from 'vigla';
import { DEV } from 'esm-env';
import type { ClientApp, Hydration } from '../types/internal/client.ts';
import type { ActionResult } from '../types/forms.ts';
import type {
	GotoOptions,
	Invalidation,
	Navigation,
	NavigationEnter,
	NavigationType,
	OnNavigate,
	PreloadResult
} from '../types/navigation.ts';
import type { RouteMatch } from '../types/paths.ts';
import { escapeHtml } from '../shared/escape.ts';
import { payload, chunks } from './payload.ts';
import type { Chunks } from './chunks.ts';
import { bindState, State } from './state.ts';
import { Routes, type Intent } from './routes.ts';
import { setMatcher } from './paths.ts';
import { FetchCache } from './fetch.ts';
import { Transport } from './transport.ts';
import { Remotes } from './remote/cache.ts';
import { Actions } from './actions.ts';
import { Pages, type Changes, type Loaded } from './load.ts';
import { View } from './view.ts';
import { Lifecycle } from './lifecycle.ts';
import { History, type Metadata } from './history.ts';
import { Restoration } from './restore.ts';
import { listen } from './links.ts';
import * as errors from './errors.ts';
import { goto_replace_state_deprecated } from './warnings.ts';

interface Transition extends GotoOptions {
	type?: NavigationType;
	event?: Event;
	delta?: number;
	popped?: Metadata;
	source?: Metadata;
	action?: ActionResult;
}

export class Client {
	readonly app: ClientApp;
	readonly owner: Owner;
	readonly routes: Routes;
	readonly state: State;
	readonly lifecycle = new Lifecycle();
	readonly actions = new Actions(this);
	readonly restoration: Restoration;
	readonly history: History;
	readonly pages: Pages;
	readonly view: View;
	readonly chunks: Chunks;
	readonly transport: Transport;
	readonly remote: Remotes;
	readonly container: Element;
	unloading = false;
	readonly ready = Promise.withResolvers<void>();
	started = false;
	navigated = false;
	updating = false;
	current: Loaded | null = null;
	readonly #target: HTMLElement;
	#token = 0;
	#warnedReplace = false;
	#invalidation = 0;
	#batch: Promise<void> | null = null;
	#changes: Changes = { all: false, dependencies: [] };
	#resetState = false;
	#preload:
		| {
				key: string;
				value: Promise<Loaded | { type: 'redirect'; status: number; location: string }>;
		  }
		| undefined;

	constructor(app: ClientApp, target: HTMLElement) {
		this.app = app;
		this.#target = target;
		this.container = payload.embedded ? target : document.documentElement;
		this.chunks = chunks;
		this.owner = root();
		this.transport = new Transport(app, this.owner);
		this.routes = new Routes(app);
		this.state = this.owner.run(() => new State(payload, app));
		this.remote = new Remotes(this, target);
		this.owner.run(() => {
			context[1](this);
			bindState(this.state);
		});
		this.history = new History(this.transport);
		this.restoration = new Restoration(
			payload.app_path ?? payload.base ?? '',
			this.routes.hash,
			this.transport
		);
		this.pages = new Pages(
			app,
			this.owner,
			this.routes,
			this.state,
			new FetchCache(),
			this.transport
		);
		this.owner.run(() => onDestroy(this.pages.fetches.observe()));
		this.view = new View(app, this.owner, target, this.state, this.routes, async (error) => {
			const token = this.#token;
			const body = await this.pages.error(error, {
				url: new URL(location.href),
				route: { id: this.current?.route.id ?? null },
				params: this.state.page.params
			});
			if (token === this.#token) this.state.update({ error: body, status: body.status });
			return body;
		});
		active = this;
		setMatcher(async (url) => {
			const intent = await this.intent(this.url(url));
			return intent ? ({ id: intent.route.id, params: intent.params } as RouteMatch) : null;
		});
		this.owner.run(() =>
			onDestroy(() => {
				this.state.dispose();
				this.chunks.dispose();
				this.view.dispose();
				if (!this.started) this.ready.reject(new Error('Client disposed before startup'));
			})
		);
		void this.ready.promise.catch(() => {});
	}

	url(value: string | URL): URL {
		const url = new URL(value, document.baseURI || location.href);
		url.search = url.search;
		return url;
	}
	intent(url: URL): Promise<Intent | null> {
		return this.owner.run(() => this.routes.match(url));
	}

	async #errorPage(error: unknown, url: URL): Promise<string | undefined> {
		if (!this.app.errorTemplate) return;
		const template = await this.app.errorTemplate();
		const body = await this.pages.error(error, {
			url,
			params: this.state.page.params,
			route: this.state.page.route
		});
		return template({ status: body.status, message: escapeHtml(body.message) });
	}

	#openInput(): () => void {
		return this.owner.run(() => openHydration({ format: this.app.format, target: this.#target }));
	}

	async start(input?: Hydration): Promise<void> {
		const closeInput = this.#openInput();
		this.owner.run(() => onDestroy(closeInput));
		try {
			await this.owner.run(() => this.app.hooks.init?.());
			this.chunks.bind(this.app, this.owner);
			const hydration = input ? this.owner.run(input) : undefined;
			const url = new URL(location.href);
			if (this.routes.hash) url.hash = decodeURIComponent(url.hash);
			let result: Loaded | { type: 'redirect'; status: number; location: string };
			if (hydration) result = await this.pages.hydrate(hydration, url);
			else {
				const intent = await this.intent(url);
				result = intent
					? await this.pages.load(intent, null, { all: false, dependencies: [] })
					: await this.pages.failure({ url, route: this.pages.fallback(), params: {} }, [], 0, {
							status: 404,
							message: 'Not Found'
						});
			}
			if (result.type === 'redirect') {
				closeInput();
				this.ready.reject(new Error('Navigation redirected'));
				this.owner.dispose();
				location.href = new URL(result.location, url).href;
				return;
			}
			this.updating = true;
			const hydrating = !!hydration && result.error === hydration.error;
			if (hydration && !hydrating) this.#target.textContent = '';
			const apply = await this.view.prepare(
				result,
				this.history.metadata()?.persistState ? this.history.state() : {},
				hydrating
			);
			this.current = result;
			apply();
			this.pages.fetches.initial = false;
			await this.view.settle();
			closeInput();
			const position = this.restoration.position(this.history.index);
			if (position || !hydrating) this.restoration.scroll(url, true, position);
			if (!hydrating && document.activeElement === document.body) this.restoration.focus(url);
			const navigation = this.navigation(url, 'enter', {}, result) as NavigationEnter;
			navigation.to!.scroll = { x: window.scrollX, y: window.scrollY };
			this.lifecycle.finish(navigation);
			this.restoration.restore(this.history.index, this.view.components);
			this.started = true;
			this.updating = false;
			this.owner.run(() => {
				onDestroy(listen(this));
				this.state.poll();
			});
			this.ready.resolve();
		} catch (error) {
			closeInput();
			this.ready.reject(error);
			try {
				const html = await this.#errorPage(error, new URL(location.href));
				if (html !== undefined) this.view.error(html);
			} finally {
				this.owner.dispose();
			}
			throw error;
		}
	}

	navigation(
		url: URL | null,
		type: NavigationType,
		options: Transition = {},
		intent?: Intent | null
	): Navigation | NavigationEnter {
		return {
			type,
			from:
				this.started && this.current
					? {
							params: this.state.page.shallow?.params ?? this.state.page.params,
							route: this.state.page.shallow?.route ?? { id: this.current.route.id },
							url: new URL(this.state.page.shallow?.url.href ?? this.current.url.href),
							scroll: { x: window.scrollX, y: window.scrollY }
						}
					: null,
			to: url
				? {
						params: intent?.params ?? null,
						route: { id: intent?.route.id ?? null },
						url,
						scroll: options.popped ? this.restoration.position(options.popped.historyIndex) : null
					}
				: null,
			willUnload: type === 'leave',
			shallow: !!options.popped?.pageUrl || (options.shallow ?? false),
			complete: Promise.resolve(),
			...(type === 'popstate' ? { delta: options.delta ?? 0, event: options.event } : {}),
			...(type === 'link' || type === 'form' ? { event: options.event } : {})
		} as Navigation | NavigationEnter;
	}

	leave(url: URL, event: MouseEvent): boolean {
		const navigation = this.navigation(url, 'link', { event }) as Navigation;
		navigation.willUnload = true;
		if (!this.lifecycle.allow(navigation)) return false;
		this.unloading = true;
		untrack(() => {
			this.state.navigation.current = navigation;
		});
		return true;
	}

	updateUrl(url: URL): void {
		this.#token++;
		if (this.current) this.current = { ...this.current, url };
		this.state.update({ url: new URL(url) });
		untrack(() => {
			this.state.navigation.current = null;
		});
	}

	async shallow(value: string | URL, state: App.PageState, replace: boolean): Promise<void> {
		const url = this.url(value);
		if (this.routes.outside(url))
			errors.navigation_external_url({
				caller: replace ? 'replaceState' : 'pushState',
				url: String(value)
			});
		const intent = await this.intent(url);
		if (!intent)
			errors.navigation_route_missing({
				caller: replace ? 'replaceState' : 'pushState',
				url: url.href
			});
		const saved = this.history.encode(state);
		const registrations = this.restoration.registrations();
		if (!replace) this.restoration.capture(this.history.index, this.view.components);
		this.history.write(url, saved, replace, true, false, this.current?.url, false);
		this.restoration.clear(this.history.index, !replace);
		this.navigated = true;
		this.state.update({
			state: saved.value,
			shallow: { url, params: intent.params, route: { id: intent.route.id } }
		});
		this.restoration.reset(registrations);
	}

	async goto(value: string | URL, options: GotoOptions = {}): Promise<void> {
		if ('noScroll' in options || 'keepFocus' in options) errors.goto_options_removed();
		const url = this.url(value);
		if (this.routes.outside(url))
			errors.navigation_external_url({ caller: 'goto', url: String(value) });
		if (DEV && options.replaceState !== undefined && !this.#warnedReplace) {
			this.#warnedReplace = true;
			goto_replace_state_deprecated({ value: String(options.replaceState) });
		}
		await this.ready.promise;
		return this.navigate(url, { ...options, type: 'goto' });
	}

	async navigate(url: URL, options: Transition = {}, redirects = 0): Promise<void> {
		const token = ++this.#token;
		const previous = this.current;
		const intent = await this.intent(url);
		if (token !== this.#token) return;
		if (!intent) {
			if (options.type === 'goto')
				errors.navigation_route_missing({ caller: 'goto', url: url.href });
			const navigation = this.navigation(url, options.type ?? 'link', options) as Navigation;
			navigation.willUnload = true;
			if (!this.lifecycle.allow(navigation)) return;
			this.unloading = true;
			location.href = url.href;
			return;
		}
		const completion = Promise.withResolvers<void>();
		void completion.promise.catch(() => {});
		const navigation = this.navigation(url, options.type ?? 'goto', options, intent) as Navigation;
		navigation.complete = completion.promise;
		const quiet = !!options.popped && options.shallow;
		if (!quiet && redirects === 0 && !this.lifecycle.allow(navigation)) {
			completion.reject(new Error('Navigation cancelled'));
			if (options.popped && options.delta) {
				if (options.source) this.history.accept(options.source);
				history.go(-options.delta);
			}
			return;
		}
		untrack(() => {
			this.state.navigation.current = navigation;
		});
		try {
			const changes: Changes = {
				all: options.refreshAll ?? options.invalidateAll ?? false,
				dependencies: (options.invalidate ?? []).map((value) => this.predicate(value))
			};
			const finishRemotes = changes.all ? this.remote.prepare() : undefined;
			const loadIntent =
				options.popped?.pageUrl && !options.shallow
					? await this.intent(this.url(options.popped.pageUrl))
					: intent;
			if (!loadIntent) {
				location.href = url.href;
				completion.resolve();
				return;
			}
			let result =
				options.shallow && previous
					? { ...previous, url: previous.url }
					: this.#preload?.key === this.routes.key(loadIntent.url) &&
						  !changes.all &&
						  !changes.dependencies.length
						? await this.#preload.value
						: await this.pages.load(
								loadIntent,
								previous,
								changes,
								options.action?.type === 'error' ? options.action.error : undefined
							);
			if (token !== this.#token) {
				completion.resolve();
				return;
			}
			if (result.type === 'redirect') {
				this.#preload = undefined;
				if (redirects < 20) {
					const destination = new URL(result.location, url);
					if (this.routes.outside(destination)) {
						location.href = destination.href;
						return;
					}
					const redirected = this.navigate(destination, options, redirects + 1);
					void redirected.then(completion.resolve, completion.reject);
					return redirected;
				}
				try {
					errors.redirect_loop({ url: url.href });
				} catch (error) {
					const root = await this.pages.rootError(loadIntent, error);
					if (root.type === 'redirect') {
						location.href = new URL(root.location, url).href;
						completion.resolve();
						return;
					}
					result = root;
				}
			}
			if (options.action && options.action.type !== 'error')
				result = this.actions.settled(result, options.action);
			if (!options.shallow) {
				result = { ...result, url: new URL(result.url) };
				result.url.hash = loadIntent.url.hash;
			}
			const after = quiet ? [] : await this.lifecycle.prepare(navigation as OnNavigate);
			if (token !== this.#token) {
				completion.resolve();
				return;
			}
			const saved = options.popped ? undefined : this.history.encode(options.state ?? {});
			const state = saved ? saved.value : this.history.state(options.popped);
			const apply = options.shallow ? undefined : await this.view.prepare(result, state);
			if (token !== this.#token) {
				completion.resolve();
				return;
			}
			this.updating = true;
			if (!options.popped) this.restoration.capture(this.history.index, this.view.components);
			const registrations = this.restoration.registrations();
			const reset = options.reset ?? !options.shallow;
			this.restoration.blur(reset);
			if (options.popped) this.history.accept(options.popped);
			else
				this.history.write(
					options.shallow ? url : result.url,
					saved!,
					options.replace ?? options.replaceState ?? false,
					!!options.shallow,
					!!options.persistState,
					previous?.url,
					reset
				);
			if (!options.popped)
				this.restoration.clear(this.history.index, !(options.replace ?? options.replaceState));
			this.navigated = true;
			const shallow = (options.popped ? options.popped.pageUrl !== undefined : options.shallow)
				? { params: intent.params, route: { id: intent.route.id }, url }
				: null;
			if (options.shallow && previous) {
				this.state.update({ state, shallow });
				if (options.popped && !options.popped.pageUrl) {
					this.current = { ...previous, url };
					this.state.update({ url: new URL(url) });
				}
			} else {
				apply!();
				if (shallow) this.state.update({ shallow });
				this.current = result;
			}
			this.#preload = undefined;
			await finishRemotes?.();
			await this.view.settle();
			const visibleUrl = shallow ? url : result.url;
			if (token !== this.#token) {
				completion.resolve();
				return;
			}
			this.restoration.scroll(
				visibleUrl,
				reset,
				options.popped ? this.restoration.position(this.history.index) : null
			);
			if (reset && !quiet && document.activeElement === document.body)
				this.restoration.focus(visibleUrl);
			completion.resolve();
			if (navigation.to) navigation.to.scroll = { x: window.scrollX, y: window.scrollY };
			for (const callback of after) callback();
			if (!quiet) this.lifecycle.finish(navigation);
			if (options.popped) this.restoration.restore(this.history.index, this.view.components);
			else if (reset) this.restoration.reset(registrations);
		} catch (error) {
			completion.reject(error);
			const html = await this.#errorPage(error, url);
			if (token === this.#token && html !== undefined) {
				this.view.error(html);
				this.owner.dispose();
			}
			throw error;
		} finally {
			if (token === this.#token) {
				this.updating = false;
				untrack(() => {
					this.state.navigation.current = null;
				});
			}
		}
	}

	predicate(value: Invalidation): (url: URL) => boolean {
		if (typeof value === 'function') return value;
		const href = new URL(value, location.href).href;
		return (url) => url.href === href;
	}

	invalidate(value?: Invalidation, keepState = false): Promise<void> {
		this.#resetState ||= !keepState;
		if (value === undefined) this.#changes.all = true;
		else this.#changes.dependencies.push(this.predicate(value));
		this.#preload = undefined;
		return (this.#batch ??= Promise.resolve().then(async () => {
			const changes = this.#changes;
			const reset = this.#resetState;
			this.#resetState = false;
			this.#changes = { all: false, dependencies: [] };
			this.#batch = null;
			if (!this.started) await this.ready.promise;
			const generation = ++this.#invalidation;
			const token = this.#token;
			const current = this.current;
			if (!current) return;
			const refreshed = changes.all ? this.remote.refresh() : undefined;
			void refreshed?.catch(() => {});
			const result = await this.pages.load(current, current, changes);
			if (generation !== this.#invalidation || token !== this.#token || current !== this.current)
				return;
			if (result.type === 'redirect')
				return this.goto(result.location, {
					replace: true,
					refreshAll: changes.all,
					invalidate: changes.dependencies,
					state: reset ? {} : this.state.page.state
				});
			result.form = this.state.page.form;
			const shallow = this.state.page.shallow;
			const apply = await this.view.prepare(result, reset ? {} : this.state.page.state);
			if (generation !== this.#invalidation || token !== this.#token || current !== this.current)
				return;
			apply();
			this.state.update({ shallow });
			this.current = result;
			await refreshed;
			await this.view.settle();
		}));
	}

	async preloadData(value: string | URL): Promise<PreloadResult> {
		const url = this.url(value);
		const intent = await this.intent(url);
		if (!intent) errors.preload_url_outside_app({ url: url.href });
		const key = this.routes.key(url);
		if (this.#preload?.key !== key)
			this.#preload = {
				key,
				value: this.pages.load(intent, this.current, { all: false, dependencies: [] })
			};
		const preload = this.#preload;
		try {
			const result = await preload.value;
			if (result.type === 'redirect') return result;
			if (result.error) {
				if (this.#preload === preload) this.#preload = undefined;
				return { type: 'error', status: result.status, error: result.error };
			}
			return {
				type: 'loaded',
				status: result.status,
				data: Object.assign({}, ...result.branch.map((node) => node?.data))
			};
		} catch (error) {
			if (this.#preload === preload) this.#preload = undefined;
			throw error;
		}
	}

	get generation(): number {
		return this.#token;
	}
	applyAction(action: ActionResult): Promise<void> {
		return this.actions.apply(action);
	}
	applySubmission(url: URL, action: ActionResult, refresh: boolean): Promise<void> {
		return this.actions.submit(url, action, refresh);
	}

	dispose(): void {
		this.owner.dispose();
	}
}

const context = createContext<Client>();
let active: Client | undefined;
export function currentClient(): Client | undefined {
	const value = context[2]() ? context[0]() : active;
	return value?.owner.disposed ? undefined : value;
}
export function client(caller: string): Client {
	const value = currentClient();
	if (!value) errors.navigation_before_start({ caller });
	return value;
}

export async function start(
	app: ClientApp,
	target: HTMLElement,
	hydration?: Hydration
): Promise<void> {
	const runtime = new Client(app, target);
	await runtime.start(hydration);
}
