import { parse, stringify, unflatten } from 'devalue';
import type { Owner } from 'vigla';
import type { ClientApp } from '../types/internal/client.ts';

export class Transport {
	readonly #app: ClientApp;
	readonly #owner: Owner;

	constructor(app: ClientApp, owner: Owner) {
		this.#app = app;
		this.#owner = owner;
	}

	parse(value: string): any {
		return this.#owner.run(() => parse(value, this.#app.decoders));
	}

	stringify(value: unknown): string {
		return this.#owner.run(() => stringify(value, this.#app.encoders));
	}

	unflatten(value: any, decoders: Record<string, (value: any) => any> = {}): any {
		return this.#owner.run(() => unflatten(value, { ...this.#app.decoders, ...decoders }));
	}
}
