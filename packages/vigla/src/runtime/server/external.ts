import {
	Connection,
	type Connected,
	type Subscribable,
	type WritableSource
} from '../../shared/external.ts';
import { onDestroy } from './context.ts';
import { owner } from '../reactivity/tracking.ts';

export function external<T>(
	read: () => Subscribable<T> | null | undefined,
	name = 'source'
): Connected<T> {
	const connection = new Connection<T>();
	if (owner !== null) onDestroy(() => connection.dispose());
	const current = (): T => {
		connection.select(read(), name, true);
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
			return current();
		},
		mutate(result) {
			set(current());
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
