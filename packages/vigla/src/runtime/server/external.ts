import {
	Connection,
	type External,
	type Subscribable,
	type WritableExternal,
	type WritableSource
} from '../../shared/external.ts';
import { onDestroy } from './context.ts';

export function external<T>(
	read: () => WritableSource<T> | null | undefined,
	name?: string
): WritableExternal<T>;
export function external<T>(
	read: () => Subscribable<T> | null | undefined,
	name?: string
): External<T>;
export function external<T>(
	read: () => Subscribable<T> | null | undefined,
	name = 'source'
): WritableExternal<T> {
	const connection = new Connection<T>();
	onDestroy(() => connection.dispose());
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
