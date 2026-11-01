import type { RemoteIterator } from '../../types/internal/remote.ts';

interface Consumer {
	pending?: IteratorResult<any>;
	waiting?: { resolve(value: IteratorResult<any>): void; reject(error: unknown): void };
	failure?: { error: unknown };
	ended: boolean;
}

export class LiveIterator implements RemoteIterator {
	readonly #source: () => AsyncGenerator<any>;
	readonly #signal: AbortSignal;
	readonly #consumers = new Set<Consumer>();
	#generator?: AsyncGenerator<any>;
	#ended = false;
	#failure?: { error: unknown };

	constructor(signal: AbortSignal, source: () => AsyncGenerator<any>) {
		this.#signal = signal;
		this.#source = source;
		signal.addEventListener('abort', this.close, { once: true });
	}

	close = (): void => {
		if (this.#ended) return;
		this.#ended = true;
		this.#signal.removeEventListener('abort', this.close);
		void this.#generator?.return(undefined).catch(() => {});
		for (const consumer of this.#consumers) this.#finish(consumer);
	};

	#finish(consumer: Consumer): void {
		consumer.ended = true;
		consumer.waiting?.resolve({ done: true, value: undefined });
		consumer.waiting = undefined;
	}

	async #pump(): Promise<void> {
		try {
			while (!this.#ended) {
				const next = await this.#generator!.next();
				if (this.#ended) return;
				if (next.done) {
					this.close();
					return;
				}
				for (const consumer of this.#consumers) {
					if (consumer.waiting) consumer.waiting.resolve(next);
					else consumer.pending = next;
					consumer.waiting = undefined;
				}
			}
		} catch (error) {
			if (!this.#ended) this.#failure = { error };
			if (!this.#ended)
				for (const consumer of this.#consumers) {
					consumer.failure = { error };
					consumer.waiting?.reject(error);
					consumer.waiting = undefined;
				}
			this.close();
		}
	}

	subscribe(): AsyncIterableIterator<any> {
		const consumer: Consumer = {
			ended: this.#ended || this.#signal.aborted,
			failure: this.#failure
		};
		if (!consumer.ended) this.#consumers.add(consumer);
		if (!consumer.ended && !this.#generator) {
			this.#generator = this.#source();
			void this.#pump();
		}
		return {
			next: () => {
				if (consumer.failure) {
					const { error } = consumer.failure;
					consumer.failure = undefined;
					consumer.pending = undefined;
					return Promise.reject(error);
				}
				const pending = consumer.pending;
				consumer.pending = undefined;
				if (pending) return Promise.resolve(pending);
				if (consumer.ended) return Promise.resolve({ done: true, value: undefined });
				return new Promise((resolve, reject) => {
					consumer.waiting = { resolve, reject };
				});
			},
			return: async () => {
				this.#finish(consumer);
				this.#consumers.delete(consumer);
				if (!this.#consumers.size) this.close();
				return { done: true, value: undefined };
			},
			[Symbol.asyncIterator]() {
				return this;
			}
		};
	}
}
