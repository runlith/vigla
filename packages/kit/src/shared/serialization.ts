import { parse, stringify } from 'devalue';
import type { Transport } from '../types/hooks.ts';

export type Encoders = Record<string, (value: any) => any>;
export type Decoders = Record<string, (value: any) => any>;

export function encoders(transport: Transport): Encoders {
	return Object.fromEntries(Object.entries(transport).map(([name, codec]) => [name, codec.encode]));
}

export function decoders(transport: Transport): Decoders {
	return Object.fromEntries(Object.entries(transport).map(([name, codec]) => [name, codec.decode]));
}

export function serialize(value: unknown, transport: Transport = {}): string {
	return stringify(value, encoders(transport));
}

export function deserialize(value: string, transport: Transport = {}): any {
	return parse(value, decoders(transport));
}
