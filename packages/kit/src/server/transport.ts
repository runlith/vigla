import type { Transport } from '../types/hooks.ts';

let configured: Transport | undefined;

export function configureTransport(transport: Transport | undefined): void {
	configured = transport;
}

export function appTransport(): Transport | undefined {
	return configured;
}
