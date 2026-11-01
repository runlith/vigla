import { settled } from 'vigla';
import type { ActionResult } from '../types/forms.ts';
import type { Client } from './client.ts';
import type { Loaded } from './load.ts';

export class Actions {
	readonly #client: Client;
	constructor(client: Client) {
		this.#client = client;
	}

	async result(page: Loaded, action: ActionResult): Promise<Loaded> {
		if (action.type === 'error')
			return this.#client.pages.failure(
				page,
				page.branch,
				page.route.layouts.length + 1,
				action.error
			);
		if (action.type === 'success' || action.type === 'failure')
			return { ...page, status: action.status, form: action.data ?? null };
		return page;
	}

	async apply(action: ActionResult): Promise<void> {
		const client = this.#client;
		await client.ready.promise;
		if (action.type === 'redirect') return client.goto(action.location, { refreshAll: true });
		if (!client.current) return;
		const generation = client.generation;
		const result = await this.result(client.current, action);
		const apply = await client.view.prepare(result, client.state.page.state);
		if (generation !== client.generation) return;
		apply();
		client.current = result;
		await settled();
		if (action.type === 'success') client.restoration.focus(result.url);
	}

	async submit(url: URL, action: ActionResult, refresh: boolean): Promise<void> {
		const client = this.#client;
		if (action.type === 'redirect') return this.apply(action);
		for (const key of [...url.searchParams.keys()])
			if (key.startsWith('/')) url.searchParams.delete(key);
		const current = client.current?.url;
		const keys = new Set([...url.searchParams.keys(), ...(current?.searchParams.keys() ?? [])]);
		const same =
			current &&
			url.origin === current.origin &&
			url.pathname === current.pathname &&
			[...keys].every((key) => {
				const before = current.searchParams.getAll(key).sort();
				const after = url.searchParams.getAll(key).sort();
				return (
					before.length === after.length && before.every((value, index) => value === after[index])
				);
			});
		if (same) {
			if (refresh) await client.invalidate(undefined, true);
			return this.apply(action);
		}
		return client.navigate(url, { type: 'form', action, refreshAll: refresh });
	}
}
