import type { Derived, Effect } from '../reactivity/graph.ts';
import { derived, set, state } from '../reactivity/sources.ts';
import { get, owner, setOwner } from '../reactivity/tracking.ts';

type Method = (this: Date, ...args: unknown[]) => unknown;

const native = Date.prototype as unknown as Record<string, Method>;

export class ReactiveDate extends Date {
	static #installed = false;

	readonly #time = state(super.getTime());
	readonly #reads = new Map<string, Derived>();
	readonly #owner: Effect | null = owner;

	constructor(...args: unknown[]) {
		super(...(args as []));
		if (!ReactiveDate.#installed) ReactiveDate.#install();
	}

	static #install(): void {
		ReactiveDate.#installed = true;
		const prototype = ReactiveDate.prototype as unknown as Record<
			string,
			(this: ReactiveDate, ...args: unknown[]) => unknown
		>;
		for (const name of Object.getOwnPropertyNames(Date.prototype)) {
			const method = native[name];
			if (name === 'constructor' || typeof method !== 'function') continue;
			if (name.startsWith('get') || name.startsWith('to') || name === 'valueOf') {
				prototype[name] = function (this: ReactiveDate, ...args: unknown[]) {
					return this.#read(name, method, args);
				};
			} else if (name.startsWith('set')) {
				prototype[name] = function (this: ReactiveDate, ...args: unknown[]) {
					const result = method.apply(this, args);
					set(this.#time, native.getTime!.call(this) as number);
					return result;
				};
			}
		}
	}

	#read(name: string, method: Method, args: unknown[]): unknown {
		if (args.length > 0) {
			get(this.#time);
			return method.apply(this, args);
		}
		let read = this.#reads.get(name);
		if (read === undefined) {
			const previous = setOwner(this.#owner);
			try {
				read = derived(() => {
					get(this.#time);
					return method.call(this);
				});
			} finally {
				setOwner(previous);
			}
			this.#reads.set(name, read);
		}
		return get(read);
	}
}
