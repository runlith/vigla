import type { Transport } from './transport.ts';

export interface Metadata {
	historyIndex: number;
	navigationIndex: number;
	state: string;
	persistState: boolean;
	pageUrl?: string;
	resetIndex: number;
}
export const metadataKey = 'sveltekit:metadata';

export class History {
	index: number;
	navigation: number;
	readonly #transport: Transport;

	constructor(transport: Transport) {
		this.#transport = transport;
		const metadata = this.metadata();
		this.index = metadata?.historyIndex ?? Date.now();
		this.navigation = metadata?.navigationIndex ?? this.index;
		if (!metadata) this.write(new URL(location.href), {}, true, false, false);
		history.scrollRestoration = 'manual';
	}

	metadata(state: any = history.state): Metadata | undefined {
		return state?.[metadataKey];
	}

	state(metadata = this.metadata()): App.PageState {
		return metadata ? this.#transport.parse(metadata.state) : {};
	}

	write(
		url: URL,
		state: App.PageState,
		replace: boolean,
		shallow: boolean,
		persist: boolean,
		pageUrl?: URL
	): void {
		if (!replace) this.index++;
		if (!shallow) this.navigation = this.index;
		const metadata: Metadata = {
			historyIndex: this.index,
			navigationIndex: this.navigation,
			state: this.#transport.stringify(state),
			persistState: persist,
			resetIndex: this.index,
			...(shallow ? { pageUrl: pageUrl?.href ?? location.href } : {})
		};
		history[replace ? 'replaceState' : 'pushState'](
			{ ...history.state, [metadataKey]: metadata },
			'',
			url
		);
	}

	accept(metadata: Metadata): void {
		this.index = metadata.historyIndex;
		this.navigation = metadata.navigationIndex;
	}
}
