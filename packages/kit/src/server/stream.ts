export class Chunks<T> {
	#pending = 0;
	#values: T[] = [];
	#failure: unknown;
	#hasFailure = false;
	#wake: (() => void) | null = null;
	#closed = false;
	readonly #signal?: AbortSignal;

	constructor(signal?: AbortSignal) {
		this.#signal = signal;
		signal?.addEventListener('abort', this.close, { once: true });
		if (signal?.aborted) this.close();
	}

	close = (): void => {
		this.#closed = true;
		this.#values.length = 0;
		this.#signal?.removeEventListener('abort', this.close);
		this.#wake?.();
		this.#wake = null;
	};

	add(promise: Promise<T>): void {
		if (this.#closed) {
			promise.catch(() => {});
			return;
		}
		this.#pending++;
		promise
			.then(
				(value) => {
					if (!this.#closed) this.#values.push(value);
				},
				(error) => {
					if (!this.#closed) {
						this.#hasFailure = true;
						this.#failure = error;
					}
				}
			)
			.finally(() => {
				this.#pending--;
				this.#wake?.();
			});
	}

	async *[Symbol.asyncIterator](): AsyncGenerator<T> {
		try {
			while (!this.#closed) {
				while (this.#values.length) yield this.#values.shift()!;
				if (this.#hasFailure) throw this.#failure;
				if (!this.#pending) return;
				await new Promise<void>((resolve) => {
					this.#wake = resolve;
				});
			}
		} finally {
			this.close();
		}
	}
}

export function streamText(
	first: string,
	chunks?: AsyncIterable<string> | null
): ReadableStream<Uint8Array> {
	const encoder = new TextEncoder();
	const iterator = (async function* () {
		yield first;
		if (chunks) yield* chunks;
	})()[Symbol.asyncIterator]();
	return new ReadableStream({
		async pull(controller) {
			try {
				const next = await iterator.next();
				if (next.done) controller.close();
				else controller.enqueue(encoder.encode(next.value));
			} catch (error) {
				controller.error(error);
			}
		},
		async cancel() {
			await iterator.return?.();
		}
	});
}
