import { cell, createContext, untrack } from 'vigla';
import { DEV } from 'esm-env';
import type { Navigation, IdleNavigation } from '../types/navigation.ts';
import type { Page, Updated } from '../types/state.ts';
import type { ClientApp, ClientPayload, MatchedParams } from '../types/internal/client.ts';

function pageCells(value: Page<MatchedParams>): Page<MatchedParams> {
	const result = {} as Page<MatchedParams>;
	for (const key of Object.keys(value) as Array<keyof Page<MatchedParams>>) {
		const held = cell(value[key]);
		Object.defineProperty(result, key, {
			enumerable: true,
			get: () => held.current,
			set: (next: Page<MatchedParams>[typeof key]) => {
				held.current = next;
			}
		});
	}
	return result;
}

export class State {
	readonly page = pageCells({
		url: new URL('a:'),
		params: {},
		route: { id: null },
		status: -1,
		error: null,
		data: {},
		form: null,
		state: {},
		shallow: null
	});
	readonly navigation = cell<Navigation | null>(null);
	readonly changed = cell(false);
	readonly updated: Updated;
	#timer: ReturnType<typeof setTimeout> | undefined;
	#checking: Promise<boolean> | undefined;
	#controller: AbortController | undefined;
	#disposed = false;
	readonly #options: ClientPayload;
	readonly #app: ClientApp | undefined;

	constructor(options: ClientPayload, app?: ClientApp) {
		this.#options = options;
		this.#app = app;
		const state = this;
		this.updated = {
			get current() {
				return state.changed.current;
			},
			check: () => state.check()
		};
	}

	update(value: Partial<Page<MatchedParams>>): void {
		untrack(() => Object.assign(this.page, value));
	}

	notify(version: string | null): void {
		if (version && this.#app?.versionChecks !== false) this.#observe(version);
	}

	#observe(version: string): void {
		if (this.#options.version !== undefined && version !== this.#options.version) {
			untrack(() => {
				this.changed.current = true;
			});
		}
	}

	poll(): void {
		const interval = this.#options.version_poll_interval;
		if (!this.#disposed && !DEV && interval && !this.changed.current)
			this.#timer = setTimeout(() => void this.check(), interval);
	}

	check(): Promise<boolean> {
		if (DEV || this.#disposed) return Promise.resolve(false);
		clearTimeout(this.#timer);
		if (this.changed.current) return Promise.resolve(true);
		if (this.#checking) return this.#checking;
		this.#controller = new AbortController();
		this.#checking = (async () => {
			try {
				const prefix = this.#options.assets || this.#options.base || '';
				const response = await fetch(`${prefix}/${this.#options.app_dir ?? '_app'}/version.json`, {
					headers: { 'cache-control': 'no-cache' },
					signal: this.#controller!.signal
				});
				if (response.ok) {
					const data: { version: string } = await response.json();
					if (typeof data.version === 'string') this.#observe(data.version);
				}
				return this.changed.current;
			} catch {
				return false;
			} finally {
				this.#checking = undefined;
				this.poll();
			}
		})();
		return this.#checking;
	}

	dispose(): void {
		this.#disposed = true;
		clearTimeout(this.#timer);
		this.#controller?.abort();
	}
}

const context = createContext<State>();
let active = new State({});

export function bindState(state: State): void {
	active = state;
	context[1](state);
}

function current(): State {
	return context[2]() ? context[0]() : active;
}

export const page: Page<MatchedParams> = {
	get url() {
		return current().page.url;
	},
	get params() {
		return current().page.params;
	},
	get route() {
		return current().page.route;
	},
	get status() {
		return current().page.status;
	},
	get data() {
		return current().page.data;
	},
	get form() {
		return current().page.form;
	},
	get error() {
		return current().page.error;
	},
	get state() {
		return current().page.state;
	},
	get shallow() {
		return current().page.shallow;
	}
};

export const navigating: Navigation | IdleNavigation = {
	get from() {
		return current().navigation.current?.from ?? null;
	},
	get to() {
		return current().navigation.current?.to ?? null;
	},
	get type() {
		return current().navigation.current?.type ?? null;
	},
	get willUnload() {
		return current().navigation.current?.willUnload ?? null;
	},
	get delta() {
		const navigation = current().navigation.current;
		return navigation?.type === 'popstate' ? navigation.delta : null;
	},
	get complete() {
		return current().navigation.current?.complete ?? null;
	}
} as Navigation | IdleNavigation;

export const updated: Updated = {
	get current() {
		return current().updated.current;
	},
	check: () => current().updated.check()
};
