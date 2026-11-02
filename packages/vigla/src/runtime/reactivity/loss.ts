import { warn } from '../../shared/diagnostics.ts';
import { active, open, processing } from './batch.ts';
import type { Source } from './graph.ts';
import { labelOf } from './trace.ts';
import { asyncRun, type Resumption } from './tracking.ts';

export let lost: Resumption | null = null;
const warned = new WeakSet<Resumption>();

function expire(run: Resumption | null): void {
	queueMicrotask(() => {
		if (lost === run) lost = null;
	});
}

export function pauseLoss(): Resumption | null {
	const previous = lost;
	lost = null;
	return previous;
}

export function resumeLoss(previous: Resumption | null): void {
	lost = previous;
}

export async function trackLoss<T>(value: T | PromiseLike<T>): Promise<() => T> {
	const run = lost ?? asyncRun();
	if (lost !== null) expire(lost);
	const resolved = await value;
	return () => {
		lost = run;
		expire(run);
		return resolved;
	};
}

export async function* trackLossEach<T>(
	iterable: Iterable<T> | AsyncIterable<T>
): AsyncGenerator<T, void> {
	const iterator: Iterator<T> | AsyncIterator<T> | undefined =
		(iterable as AsyncIterable<T>)[Symbol.asyncIterator]?.() ??
		(iterable as Iterable<T>)[Symbol.iterator]?.();
	if (iterator === undefined) throw new TypeError('value is not async iterable');
	let close = true;
	try {
		while (true) {
			const { done, value } = (await trackLoss(iterator.next()))();
			if (done) {
				close = false;
				break;
			}
			const run = lost;
			try {
				yield value;
			} catch (error) {
				lost = run;
				if (iterator.return !== undefined) (await trackLoss(iterator.return()))();
				throw error;
			}
			lost = run;
		}
	} catch (error) {
		close = false;
		throw error;
	} finally {
		if (close && iterator.return !== undefined) (await trackLoss(iterator.return()))();
	}
}

export function lose(source: Source): void {
	const run = lost;
	if (run === null || warned.has(run) || run.reads.has(source)) return;
	if (active !== null || open !== null || processing !== null) return;
	warned.add(run);
	warn(
		'await_reactivity_loss',
		`Detected reactivity loss when reading \`${labelOf(source)}\`. This happens when state is read in an async function after an earlier \`await\``
	);
	const trace = new Error();
	Object.defineProperty(trace, 'name', { value: 'traced at' });
	console.warn(trace);
}
