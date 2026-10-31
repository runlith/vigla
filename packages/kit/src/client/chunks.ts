import type { Owner } from 'vigla';
import type { ChunkDecoder, ClientApp } from '../types/internal/client.ts';

interface Deferred {
	promise: Promise<unknown>;
	resolve(value: unknown): void;
	reject(error: unknown): void;
	used: boolean;
	settled: boolean;
}

export class Chunks {
	readonly #pending = new Map<number, Deferred>();
	readonly #queued = new Map<number, ChunkDecoder>();
	#app: ClientApp | undefined;
	#owner: Owner | undefined;
	#disposed = false;

	#record(id: number): Deferred {
		let record = this.#pending.get(id);
		if (!record) {
			record = { ...Promise.withResolvers<unknown>(), used: false, settled: false };
			void record.promise.catch(() => {});
			this.#pending.set(id, record);
		}
		return record;
	}

	#release(id: number, record: Deferred): void {
		if (record.used && record.settled)
			queueMicrotask(() => {
				if (this.#pending.get(id) === record) this.#pending.delete(id);
			});
	}

	defer(id: number): Promise<unknown> {
		const record = this.#record(id);
		record.used = true;
		this.#release(id, record);
		return record.promise;
	}

	resolve(id: number, decode: ChunkDecoder): void {
		if (this.#disposed) return;
		if (!this.#owner || !this.#app) {
			this.#queued.set(id, decode);
			return;
		}
		const record = this.#record(id);
		try {
			const [data, error] = this.#owner.run(() => decode(this.#app!));
			if (error !== undefined) record.reject(error);
			else record.resolve(data);
		} catch (error) {
			record.reject(error);
		}
		record.settled = true;
		this.#release(id, record);
	}

	bind(app: ClientApp, owner: Owner): void {
		this.#app = app;
		this.#owner = owner;
		for (const [id, decode] of this.#queued) this.resolve(id, decode);
		this.#queued.clear();
	}

	dispose(): void {
		this.#disposed = true;
		for (const record of this.#pending.values())
			record.reject(new Error('The tab owner was disposed'));
		this.#pending.clear();
		this.#queued.clear();
	}
}
