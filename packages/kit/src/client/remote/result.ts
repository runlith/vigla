import { cell, tick, untrack } from 'vigla';
import { HttpError } from '../../shared/outcomes.ts';

export class Result<T> implements Promise<T> {
	readonly value = cell<T | undefined>(undefined);
	readonly available = cell(false);
	readonly failure = cell<App.Error | undefined>(undefined);
	readonly busy = cell(true);
	readonly promise = cell<Promise<void> | undefined>(undefined);
	readonly #waiting: PromiseWithResolvers<void>[] = [];

	start(): void {}
	track(): void {}
	read(): T | undefined {
		return this.value.current;
	}

	begin(): PromiseWithResolvers<void> {
		const request = Promise.withResolvers<void>();
		void request.promise.catch(() => {});
		this.#waiting.push(request);
		untrack(() => {
			this.busy.current = true;
			this.promise.current = request.promise;
		});
		return request;
	}

	pending(request: PromiseWithResolvers<void>): boolean {
		return this.#waiting.includes(request);
	}

	set(value: T, request?: PromiseWithResolvers<void>): void {
		const index = request ? this.#waiting.indexOf(request) : this.#waiting.length - 1;
		if (request && index < 0) return;
		const waiting = this.#waiting.splice(0, index + 1);
		untrack(() => {
			this.value.current = value;
			this.available.current = true;
			this.busy.current = false;
			this.failure.current = undefined;
			if (!waiting.length) this.promise.current = Promise.resolve();
		});
		for (const entry of waiting) entry.resolve();
	}

	fail(error: HttpError, request?: PromiseWithResolvers<void>): void {
		const index = request ? this.#waiting.indexOf(request) : this.#waiting.length - 1;
		if (request && index < 0) return;
		const waiting = this.#waiting.splice(0, index + 1);
		untrack(() => {
			this.busy.current = false;
			this.failure.current = error.body;
			if (!request) {
				const rejected = Promise.reject(error);
				void rejected.catch(() => {});
				this.promise.current = rejected;
			}
		});
		for (const entry of waiting) {
			if (request && entry !== request) entry.resolve();
			else entry.reject(error);
		}
	}

	get then(): Promise<T>['then'] {
		this.start();
		const pending = this.promise.current ?? Promise.resolve();
		this.track();
		const value = pending.then(tick).then(() => {
			if (!this.available.current)
				throw new HttpError(
					this.failure.current ?? { status: 500, message: 'Query resolved without a value' }
				);
			return untrack(() => this.read()) as T;
		});
		void value.catch(() => {});
		return value.then.bind(value);
	}

	catch<TResult = never>(
		onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null
	): Promise<T | TResult> {
		return this.then(undefined, onrejected);
	}

	finally(onfinally?: (() => void) | null): Promise<T> {
		return this.then().finally(onfinally);
	}

	get current(): T | undefined {
		this.start();
		return this.available.current ? this.read() : undefined;
	}
	get error(): App.Error | undefined {
		this.start();
		return this.failure.current;
	}
	get loading(): boolean {
		this.start();
		return this.busy.current;
	}
	get ready(): boolean {
		this.start();
		return this.available.current;
	}
	get [Symbol.toStringTag](): string {
		return 'RemoteResource';
	}
}
