import { DEV } from 'esm-env';
import {
	Connection,
	type Connected,
	type Subscribable,
	type WritableSource
} from '../../shared/external.ts';
import { write } from './batch.ts';
import { sequence } from './history.ts';
import { teardown } from './effects.ts';
import { mutableSource } from './sources.ts';
import { tag } from './trace.ts';
import { get, untrack } from './tracking.ts';

export function external<T>(
	read: () => Subscribable<T> | null | undefined,
	name = 'source',
	label = name
): Connected<T> {
	const value = mutableSource<T>(undefined as T);
	if (DEV) tag(value, label);
	const connection = new Connection<T>((_before, next) => {
		write(value, next, sequence());
	});
	teardown(() => connection.dispose());
	const current = (): T => {
		const input = read();
		untrack(() => connection.select(input, name));
		value.v = connection.value;
		return get(value);
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
			return untrack(current);
		},
		mutate(result) {
			set(untrack(current));
			return result;
		},
		refresh(result) {
			connection.refresh(untrack(read));
			return result;
		},
		dispose() {
			connection.dispose();
		}
	};
}
