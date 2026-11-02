import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { test } from 'node:test';
import { asyncDerived, work } from './src/runtime/reactivity/async.ts';
import { flushSync, resumed, settled, suspend } from './src/runtime/reactivity/batch.ts';
import { block, effect } from './src/runtime/reactivity/effects.ts';
import { fork } from './src/runtime/reactivity/fork.ts';
import { root } from './src/runtime/reactivity/owners.ts';
import { set, state } from './src/runtime/reactivity/sources.ts';
import { get } from './src/runtime/reactivity/tracking.ts';

test('an earlier async commit becomes the visible base of a later pending result', async () => {
	const scope = root();
	const a = state(0);
	const b = state(0);
	const show = state(false);
	const queued: (() => void)[] = [];
	const delay = (value: number): number | Promise<number> =>
		value === 0 ? value : new Promise((resolve) => queued.push(() => resolve(value)));
	try {
		const first = await scope.run(() => asyncDerived(() => delay(get(a))));
		const result = await scope.run(() => asyncDerived(() => delay(get(first) + get(b))));
		const seen: number[] = [];
		scope.run(() =>
			effect(() => {
				if (get(show)) seen.push(get(first));
			})
		);
		await setImmediate();
		set(a, 1);
		await setImmediate();
		set(a, 2);
		set(b, 1);
		await setImmediate();
		queued.splice(1, 1)[0]!();
		await setImmediate();
		queued.shift()!();
		await setImmediate();
		queued.shift()!();
		queued.splice(1, 1)[0]!();
		await setImmediate();
		set(show, true);
		await setImmediate();
		assert.deepEqual(seen, [1]);
		queued.shift()!();
		await settled();
		assert.deepEqual(seen, [1, 2]);
		assert.equal(get(first), 2);
		assert.equal(get(result), 3);
	} finally {
		scope.dispose();
		flushSync();
	}
});

test('a stale initial result cannot retain dependencies the published run dropped', async () => {
	const scope = root();
	const choose = state(true);
	const previous = state(1);
	const next = state(2);
	const calls: number[] = [];
	const queued: (() => void)[] = [];
	try {
		const ready = scope.run(() =>
			asyncDerived(() => {
				const value = get(choose) ? get(previous) : get(next);
				calls.push(value);
				return new Promise<number>((resolve) => queued.push(() => resolve(value)));
			})
		);
		await setImmediate();
		set(choose, false);
		await setImmediate();
		queued.pop()!();
		const result = await ready;
		await setImmediate();
		queued.shift()!();
		await setImmediate();
		set(previous, 3);
		await setImmediate();
		assert.deepEqual(calls, [1, 2]);
		assert.equal(get(result), 2);
	} finally {
		scope.dispose();
		flushSync();
	}
});

test('a merged batch can publish a later run through a restored continuation', async () => {
	const scope = root();
	const value = state(0);
	const queued = new Map<number, () => void>();
	const release = new Map<number, () => void>();
	const restore = new Map<number, () => void>();
	try {
		const result = await scope.run(() =>
			asyncDerived(() => {
				const current = get(value);
				return current === 0
					? 0
					: new Promise<number>((resolve) => {
							queued.set(current, () => resolve(current));
						});
			})
		);
		scope.run(() =>
			block(() => {
				const current = get(value);
				if (current === 0) return;
				release.set(current, work());
				restore.set(current, suspend());
			})
		);
		set(value, 1);
		await setImmediate();
		set(value, 2);
		await setImmediate();
		queued.get(2)!();
		await setImmediate();
		release.get(2)!();
		await setImmediate();
		restore.get(1)!();
		set(value, 3);
		resumed();
		await setImmediate();
		queued.get(3)!();
		await setImmediate();
		release.get(1)!();
		release.get(3)!();
		await settled();
		assert.equal(get(result), 3);
	} finally {
		resumed();
		scope.dispose();
		flushSync();
	}
});

test('a speculative async result cannot suppress a real publication', async () => {
	const scope = root();
	const value = state(0);
	const queued = new Map<number, () => void>();
	let discard = (): void => {};
	try {
		const result = await scope.run(() =>
			asyncDerived(() => {
				const current = get(value);
				return current === 0
					? 0
					: new Promise<number>((resolve) => {
							queued.set(current, () => resolve(current));
						});
			})
		);
		set(value, 1);
		await setImmediate();
		const speculative = fork(() => set(value, 2));
		discard = speculative.discard;
		queued.get(2)!();
		await setImmediate();
		queued.get(1)!();
		await settled();
		assert.equal(get(result), 1);
		speculative.discard();
		assert.equal(get(result), 1);
	} finally {
		discard();
		scope.dispose();
		flushSync();
	}
});
