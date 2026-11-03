import { getContext, getOwner, onDestroy, setContext, type Owner } from 'vigla';

const layers = [
	'config',
	'http',
	'auth',
	'users',
	'cache',
	'search',
	'analytics',
	'billing',
	'notifications',
	'ui'
];

export interface Journal {
	write(line: string): void;
}

function layer(index: number, journal: Journal): void {
	if (index === layers.length) return;
	getOwner()!.root(() => {
		const name = layers[index]!;
		const below = getContext<string | undefined>('service');
		const request = getContext<number>('request');
		setContext('service', name);
		journal.write(`#${request} ${name} up, uses ${below ?? 'nothing'}`);
		onDestroy(() => journal.write(`#${request} ${name} down`));
		layer(index + 1, journal);
	});
}

export function openRequest(app: Owner, id: number, journal: Journal): Owner {
	return app.root(() => {
		setContext('request', id);
		layer(0, journal);
	});
}

export interface Api {
	search(term: string): Promise<string[]>;
}

const words = [
	'async',
	'context',
	'hydration',
	'kit',
	'owner',
	'runes',
	'scheduler',
	'server',
	'signal',
	'svelte',
	'vigla',
	'vite'
];

export const api: Api = {
	async search(term) {
		await new Promise((resolve) => setTimeout(resolve, 400));
		return words.filter((word) => word.includes(term.toLowerCase()));
	}
};
