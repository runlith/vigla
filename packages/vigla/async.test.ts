import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { test } from 'node:test';
import { cell, effect, external, fork, root, tick } from './src/entries/index.ts';
import {
	asyncDerived,
	derived,
	get,
	proxy,
	save,
	set,
	state,
	unsave
} from './src/entries/internal/client.ts';
import { work } from './src/runtime/reactivity/async.ts';
import { flushSync, resumed, settled, suspend } from './src/runtime/reactivity/batch.ts';
import { block } from './src/runtime/reactivity/effects.ts';

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

test('an older held batch publishes a fresh run after a newer commit', async () => {
	const scope = root();
	const a = state(1);
	const b = state(2);
	const queued: (() => void)[] = [];
	try {
		const result = await scope.run(() =>
			asyncDerived(() => {
				const value = get(a) + get(b);
				return value === 3
					? value
					: new Promise<number>((resolve) => queued.push(() => resolve(value)));
			})
		);
		set(a, 2);
		flushSync();
		set(b, 3);
		flushSync();
		queued.pop()!();
		await setImmediate();
		assert.equal(get(result), 4);
		queued.pop()!();
		await settled();
		assert.equal(get(result), 5);
	} finally {
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

test('a merged real commit supersedes older fork writes without losing other sources', async () => {
	const scope = root();
	const input = cell(0);
	const other = cell(0);
	let shown = -1;
	try {
		const value = await scope.run(() =>
			asyncDerived(() => (input.current === 1 ? new Promise<number>(() => {}) : input.current))
		);
		scope.run(() =>
			effect(() => {
				shown = get(value);
			})
		);
		await tick();
		input.current = 1;
		await setImmediate();
		const staged = fork(() => {
			input.current = 2;
			other.current = 1;
		});
		await setImmediate();
		input.current = 3;
		await setImmediate();
		assert.deepEqual([input.current, shown, other.current], [3, 3, 0]);
		await staged.commit();
		assert.deepEqual([input.current, shown, other.current], [3, 3, 1]);
	} finally {
		scope.dispose();
		flushSync();
	}
});

test('a later fork write survives an earlier real commit', async () => {
	const scope = root();
	const input = cell(0);
	let release!: (value: number) => void;
	let shown = -1;
	try {
		const value = await scope.run(() =>
			asyncDerived(() =>
				input.current === 1
					? new Promise<number>((resolve) => {
							release = resolve;
						})
					: input.current
			)
		);
		scope.run(() =>
			effect(() => {
				shown = get(value);
			})
		);
		await tick();
		input.current = 1;
		await setImmediate();
		const staged = fork(() => {
			input.current = 2;
		});
		await setImmediate();
		release(1);
		await setImmediate();
		assert.deepEqual([input.current, shown], [1, 1]);
		await staged.commit();
		assert.deepEqual([input.current, shown], [2, 2]);
	} finally {
		scope.dispose();
		flushSync();
	}
});

test('a newer real dependency write invalidates an older fork derived override', async () => {
	const scope = root();
	const input = cell(0);
	const other = cell(0);
	let shown = -1;
	try {
		const value = scope.run(() => derived(() => input.current * 10));
		scope.run(() =>
			effect(() => {
				shown = get(value);
			})
		);
		await tick();
		const staged = fork(() => {
			input.current = 1;
			set(value, 99);
			other.current = 1;
		});
		input.current = 2;
		await tick();
		await staged.commit();
		assert.deepEqual([input.current, get(value), shown, other.current], [2, 20, 20, 1]);
	} finally {
		scope.dispose();
		flushSync();
	}
});

test('a resumed owner proxy write supersedes an older fork value', async () => {
	const scope = root();
	const value = proxy({ current: 0 });
	const other = cell(0);
	const gate = Promise.withResolvers<void>();
	let shown = -1;
	try {
		scope.run(() =>
			effect(() => {
				shown = value.current;
			})
		);
		await tick();
		const running = scope.start(async () => {
			(await save(gate.promise))();
			try {
				value.current = 3;
			} finally {
				unsave();
			}
		});
		await tick();
		const staged = fork(() => {
			value.current = 2;
			other.current = 1;
		});
		gate.resolve();
		await running;
		await tick();
		assert.deepEqual([value.current, shown, other.current], [3, 3, 0]);
		await staged.commit();
		assert.deepEqual([value.current, shown, other.current], [3, 3, 1]);
	} finally {
		scope.dispose();
		flushSync();
	}
});

test('an unchanged immediate derived dependency preserves a fork override', async () => {
	const scope = root();
	const input = cell(0);
	let shown = -1;
	try {
		const parity = scope.run(() => derived(() => input.current % 2));
		const output = scope.run(() => derived(() => get(parity)));
		scope.run(() =>
			effect(() => {
				shown = get(output);
			})
		);
		await tick();
		const first = fork(() => set(output, 99));
		input.current = 2;
		await tick();
		await first.commit();
		assert.deepEqual([get(output), shown], [99, 99]);
		const second = fork(() => {
			input.current = 3;
			set(output, 99);
		});
		input.current = 5;
		await tick();
		await second.commit();
		assert.deepEqual([input.current, get(output), shown], [5, 99, 99]);
		const third = fork(() => {
			input.current = 7;
			set(output, 88);
			input.current = 9;
		});
		await third.commit();
		assert.deepEqual([input.current, get(output), shown], [9, 88, 88]);
	} finally {
		scope.dispose();
		flushSync();
	}
});

test('a resumed external emission supersedes an older fork value', async () => {
	const scope = root();
	const subscribers = new Set<(value: number) => void>();
	let raw = 0;
	const input = {
		subscribe(receive: (value: number) => void) {
			subscribers.add(receive);
			receive(raw);
			return () => {
				subscribers.delete(receive);
			};
		}
	};
	const emit = (next: number) => {
		raw = next;
		for (const receive of subscribers) receive(next);
	};
	const value = scope.run(() => external(() => input));
	const other = cell(0);
	const gate = Promise.withResolvers<void>();
	let shown = -1;
	try {
		scope.run(() =>
			effect(() => {
				shown = value.current;
			})
		);
		await tick();
		const running = scope.start(async () => {
			(await save(gate.promise))();
			try {
				emit(3);
			} finally {
				unsave();
			}
		});
		await tick();
		const forkGate = Promise.withResolvers<void>();
		let forkWork!: Promise<void>;
		const staged = fork(() => {
			emit(2);
			other.current = 1;
			forkWork = scope.start(() => forkGate.promise);
		});
		const completed = staged.commit();
		await tick();
		gate.resolve();
		await running;
		await tick();
		assert.deepEqual([value.current, shown], [3, 3]);
		forkGate.resolve();
		await forkWork;
		await completed;
		assert.deepEqual([value.current, shown, other.current], [3, 3, 1]);
	} finally {
		scope.dispose();
		flushSync();
	}
});
