import { cell, hydrate, mount, unmount, type Owner } from 'vigla';
import type {
	ClientApp,
	ComponentInstance,
	RenderNode,
	RootProps
} from '../types/internal/client.ts';
import type { Component } from 'vigla';
import type { Loaded } from './load.ts';
import type { State } from './state.ts';
import type { Routes } from './routes.ts';

class Tree implements RenderNode {
	readonly #component = cell<Component<any, any>>(null!);
	readonly #error = cell<Component<any, any> | undefined>(undefined);
	readonly #data = cell<Record<string, any>>({});
	readonly #child = cell<RenderNode | null>(null);
	get component(): Component<any, any> {
		return this.#component.current;
	}
	set component(value: Component<any, any>) {
		this.#component.current = value;
	}
	get error(): Component<any, any> | undefined {
		return this.#error.current;
	}
	set error(value: Component<any, any> | undefined) {
		this.#error.current = value;
	}
	get data(): Record<string, any> {
		return this.#data.current;
	}
	set data(value: Record<string, any>) {
		this.#data.current = value;
	}
	get child(): RenderNode | null {
		return this.#child.current;
	}
	set child(value: RenderNode | null) {
		this.#child.current = value;
	}
}

export class View {
	readonly components: ComponentInstance[] = [];
	readonly #trees: Tree[] = [];
	#branches: Loaded['branch'] = [];
	readonly #root = cell<RenderNode>(null!);
	readonly #resets = new Set<() => void>();
	readonly #app: ClientApp;
	readonly #owner: Owner;
	readonly #target: HTMLElement;
	readonly #state: State;
	readonly #routes: Routes;
	readonly #onerror: (error: unknown) => void;
	#instance: Record<string, unknown> | undefined;

	constructor(
		app: ClientApp,
		owner: Owner,
		target: HTMLElement,
		state: State,
		routes: Routes,
		onerror: (error: unknown) => void
	) {
		this.#app = app;
		this.#owner = owner;
		this.#target = target;
		this.#state = state;
		this.#routes = routes;
		this.#onerror = onerror;
	}

	async prepare(result: Loaded, state: App.PageState, hydratePage = false): Promise<() => void> {
		const errors = await Promise.all(
			result.route.errors.map((loader) =>
				loader
					? this.#routes
							.load(loader)
							.then((node) => node.component)
							.catch(() => undefined)
					: undefined
			)
		);
		return () => this.#commit(result, state, errors, hydratePage);
	}

	#commit(
		result: Loaded,
		state: App.PageState,
		errors: Array<Component<any, any> | undefined>,
		hydratePage: boolean
	): void {
		let data: Record<string, any> = {};
		let depth = 0;
		let parent: Tree | undefined;
		let changed = false;
		for (const [index, branch] of result.branch.entries()) {
			if (!branch) continue;
			const tree = (this.#trees[depth] ??= new Tree());
			changed ||= !this.#branches[index] || branch.data !== this.#branches[index]!.data;
			data = changed ? { ...data, ...branch.data } : tree.data;
			tree.component = branch.node.component;
			tree.error = index ? errors[index] : undefined;
			tree.data = data;
			if (parent) parent.child = tree;
			else this.#root.current = tree;
			parent = tree;
			depth++;
		}
		if (parent) parent.child = null;
		this.#trees.length = depth;
		this.#branches = result.branch;
		this.#state.update({
			url: new URL(result.url),
			params: result.params,
			route: { id: result.route.id },
			status: result.status,
			data,
			form: result.form,
			error: result.error,
			state,
			shallow: null
		});
		for (const reset of this.#resets) reset();
		this.#resets.clear();
		if (!this.#instance) {
			const view = this;
			const props: RootProps = {
				page: this.#state.page,
				components: this.components,
				get tree() {
					return view.#root.current;
				},
				get form() {
					return view.#state.page.form;
				},
				get error() {
					return view.#state.page.error;
				},
				onerror: (error, reset) => {
					this.#resets.add(reset);
					this.#onerror(error);
				}
			};
			this.#instance = this.#owner.run(() =>
				(hydratePage ? hydrate : mount)(this.#app.root, {
					target: this.#target,
					props,
					format: this.#app.format,
					intro: !hydratePage
				})
			);
		}
	}

	error(html: string): void {
		const parsed = new DOMParser().parseFromString(html, 'text/html');
		document.head.replaceWith(document.adoptNode(parsed.head));
		document.body.replaceWith(document.adoptNode(parsed.body));
	}

	dispose(): void {
		if (this.#instance) void unmount(this.#instance);
	}
}
