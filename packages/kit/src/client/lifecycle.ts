import { getOwner, onDestroy, type Owner } from 'vigla';
import type {
	AfterNavigate,
	BeforeNavigate,
	Navigation,
	NavigationCallback,
	NavigationEnter,
	OnNavigate
} from '../types/navigation.ts';

interface Registration<T> {
	callback: (value: T) => unknown;
	owner: Owner | null;
}

export class Lifecycle {
	readonly #before = new Set<Registration<BeforeNavigate>>();
	readonly #on = new Set<Registration<OnNavigate>>();
	readonly #after = new Set<Registration<AfterNavigate>>();

	#register<T>(set: Set<Registration<T>>, callback: (value: T) => unknown): void {
		const registration = { callback, owner: getOwner() };
		set.add(registration);
		if (registration.owner) onDestroy(() => set.delete(registration));
	}

	before(callback: (navigation: BeforeNavigate) => void): void {
		this.#register(this.#before, callback);
	}
	on(callback: NavigationCallback): void {
		this.#register(this.#on, callback);
	}
	after(callback: (navigation: AfterNavigate) => void): void {
		this.#register(this.#after, callback);
	}

	allow(navigation: Navigation): boolean {
		let cancelled = false;
		const event: BeforeNavigate = {
			...navigation,
			cancel() {
				cancelled = true;
			}
		};
		for (const registration of this.#before) {
			if (registration.owner) registration.owner.run(() => registration.callback(event));
			else registration.callback(event);
		}
		return !cancelled;
	}

	async prepare(navigation: OnNavigate): Promise<Array<() => void>> {
		const values = await Promise.all(
			[...this.#on].map((registration) =>
				registration.owner
					? registration.owner.run(() => registration.callback(navigation))
					: registration.callback(navigation)
			)
		);
		return values.filter((value): value is () => void => typeof value === 'function');
	}

	finish(navigation: Navigation | NavigationEnter): void {
		if (navigation.willUnload || navigation.type === 'leave') return;
		for (const registration of this.#after) {
			if (registration.owner)
				registration.owner.run(() => registration.callback(navigation as AfterNavigate));
			else registration.callback(navigation as AfterNavigate);
		}
	}
}
