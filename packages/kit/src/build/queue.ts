export class Queue {
	#waiting: Array<() => Promise<void>> = [];
	#active = 0;
	#closed = false;
	#completion = Promise.withResolvers<void>();
	readonly concurrency: number;
	constructor(concurrency: number) {
		this.concurrency = concurrency;
		if (!Number.isInteger(concurrency) || concurrency < 1)
			throw new RangeError('Concurrency must be a positive integer');
		this.#completion.promise.catch(() => {});
	}
	add<T>(run: () => T | Promise<T>): Promise<T> {
		if (this.#closed) throw new Error('Cannot add tasks to a queue that has ended');
		const result = Promise.withResolvers<T>();
		result.promise.catch(() => {});
		this.#waiting.push(async () => {
			try {
				result.resolve(await run());
			} catch (error) {
				result.reject(error);
				this.#completion.reject(error);
			}
		});
		this.#drain();
		return result.promise;
	}
	done(): Promise<void> {
		if (!this.#active && !this.#waiting.length) {
			this.#closed = true;
			this.#completion.resolve();
		}
		return this.#completion.promise;
	}
	#drain(): void {
		while (this.#active < this.concurrency && this.#waiting.length) {
			const run = this.#waiting.shift()!;
			this.#active++;
			void run().finally(() => {
				this.#active--;
				this.#drain();
			});
		}
		if (!this.#active && !this.#waiting.length) {
			this.#closed = true;
			this.#completion.resolve();
		}
	}
}
