import { DEV } from 'esm-env';

function fail(code: string, message: string): never {
	const error = new Error(
		DEV ? `${code}\n${message}\nhttps://svelte.dev/e/${code}` : `https://svelte.dev/e/${code}`
	);
	error.name = 'Svelte error';
	throw error;
}

export function orphan(rune: string): never {
	return fail(
		'effect_orphan',
		`\`${rune}\` can only be used inside an effect (e.g. during component initialisation)`
	);
}

export function depthExceeded(): never {
	return fail(
		'effect_update_depth_exceeded',
		'Maximum update depth exceeded. This typically indicates that an effect reads and writes the same piece of state'
	);
}
