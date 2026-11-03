import {
	Connection,
	type Connected,
	type Subscribable,
	type WritableSource
} from '../../shared/external.ts';
import { onDestroy } from '../reactivity/owners.ts';
import { ambient } from '../reactivity/carried.ts';
import { untrack } from '../reactivity/tracking.ts';
import { track, type Dependency } from './cells.ts';

export function external<T>(
	read: () => Subscribable<T> | null | undefined,
	name = 'source'
): Connected<T> {
	let last: T | undefined;
	const emitted = {
		version: 0,
		settle(): void {
			connection.select(read(), name, true);
			if (emitted.version > 0 && Object.is(connection.value, last)) return;
			last = connection.value;
			emitted.version++;
		}
	} satisfies Dependency;
	const connection = new Connection<T>(() => emitted.version++);
	if (ambient() !== null) onDestroy(() => connection.dispose());
	const current = (): T => {
		emitted.settle();
		track(emitted);
		return connection.value;
	};
	const set = (value: T): void => (read() as WritableSource<T>).set(value);
	return {
		get current() {
			return current();
		},
		set current(value: T) {
			set(value);
		},
		get peek() {
			return untrack(() => {
				emitted.settle();
				return connection.value;
			});
		},
		mutate(result) {
			set(untrack(current));
			return result;
		},
		refresh(result) {
			connection.refresh(read());
			return result;
		},
		dispose() {
			connection.dispose();
		}
	};
}
