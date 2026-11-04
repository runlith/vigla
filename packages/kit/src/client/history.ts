import type { Transport } from './transport.ts';
import { identity } from '../shared/identity.ts';

export interface Metadata {
	historyIndex: number;
	navigationIndex: number;
	state: string;
	persistState: boolean;
	pageUrl?: string;
	resetIndex: number;
}
export interface SavedState {
	serialized: string;
	value: App.PageState;
}
export const metadataKey = `${identity.name}:metadata`;

export interface HistoryEntry {
	index: number;
	navigation: number;
}

export class History implements HistoryEntry {
	index: number;
	navigation: number;
	reset: number;
	#current!: Metadata;
	readonly #transport: Transport;

	constructor(transport: Transport) {
		this.#transport = transport;
		const metadata = this.metadata();
		this.index = metadata?.historyIndex ?? Date.now();
		this.navigation = metadata?.navigationIndex ?? this.index;
		this.reset = metadata?.resetIndex ?? 0;
		if (metadata) this.#current = metadata;
		else this.write(new URL(location.href), this.encode({}), true, false, false, undefined, false);
		history.scrollRestoration = 'manual';
	}

	get current(): Metadata {
		return this.#current;
	}

	metadata(state: any = history.state): Metadata | undefined {
		return state?.[metadataKey];
	}

	state(metadata = this.#current): App.PageState {
		return this.#transport.parse(metadata.state);
	}

	encode(state: App.PageState): SavedState {
		const serialized = this.#transport.stringify(state);
		return { serialized, value: this.#transport.parse(serialized) };
	}

	write(
		url: URL,
		state: SavedState,
		replace: boolean,
		shallow: boolean,
		persist: boolean,
		pageUrl?: URL,
		reset = !shallow
	): void {
		if (!replace) {
			this.index++;
			if (!shallow) this.navigation++;
		}
		if (reset) this.reset++;
		const metadata: Metadata = {
			historyIndex: this.index,
			navigationIndex: this.navigation,
			state: state.serialized,
			persistState: persist,
			resetIndex: this.reset,
			...(shallow ? { pageUrl: pageUrl?.href ?? location.href } : {})
		};
		history[replace ? 'replaceState' : 'pushState']({ [metadataKey]: metadata }, '', url);
		this.#current = metadata;
	}

	fragment(url: URL, source: Metadata, reset: boolean): void {
		this.accept({
			...source,
			historyIndex: this.index + 1,
			resetIndex: this.reset + Number(reset)
		});
		history.replaceState({ ...history.state, [metadataKey]: this.#current }, '', url);
	}

	accept(metadata: Metadata): void {
		this.#current = metadata;
		this.index = metadata.historyIndex;
		this.navigation = metadata.navigationIndex;
		this.reset = metadata.resetIndex;
	}
}
