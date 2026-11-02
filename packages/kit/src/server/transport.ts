import type { Transport } from '../types/hooks.ts';

const unset = Symbol();
let only: Transport | undefined | typeof unset = unset;
let shared = false;

export function configureTransport(transport: Transport | undefined): void {
	if (only === unset) only = transport;
	else if (only !== transport) shared = true;
}

export function appTransport(): Transport | undefined {
	return shared || only === unset ? undefined : only;
}
