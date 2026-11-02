import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as core from 'vigla';

const { cell, effect, root, tick, flushSync, onDestroy, createContext, getAbortSignal, settled } =
	core;

test('a derived tracks a service-owned cell read after Owner.run returns', async () => {
	const service = root();
	const view = root();
	let state: core.Cell<number> | undefined;
	let shown: number | undefined;
	try {
		const value = view.run(() =>
			core.derived(() => {
				state ??= service.run(() => cell(0));
				return state.current;
			})
		);
		view.run(() => effect(() => void (shown = value.current)));
		await tick();
		state!.current = 1;
		await tick();
		assert.equal(shown, 1);
	} finally {
		view.dispose();
		service.dispose();
	}
});

test('owned derived values memoize, accept overrides and release their evaluation', () => {
	const owner = root();
	const input = cell(1);
	let runs = 0;
	let signal: AbortSignal | undefined;
	const value = owner.run(() =>
		core.derived(() => {
			runs++;
			signal = getAbortSignal();
			return input.current * 2;
		})
	);
	try {
		assert.equal(value.current, 2);
		assert.equal(value.current, 2);
		assert.equal(runs, 1);
		input.current = 2;
		value.current = 10;
		assert.equal(value.current, 10);
		assert.equal(runs, 2);
		input.current = 3;
		assert.equal(value.current, 6);
		owner.dispose();
		assert.equal(signal!.aborted, true);
		assert.equal(signal!.reason.name, 'StaleReactionError');
	} finally {
		owner.dispose();
	}
});

test('ten owner layers inherit late context and retain local overrides', () => {
	const app = root();
	const [read, write] = createContext<number>();
	let deepest = app;
	for (let index = 0; index < 10; index++) deepest = root(undefined, deepest);
	const sibling = root(undefined, app);
	try {
		app.run(() => write(42));
		assert.equal(deepest.run(read), 42);
		deepest.run(() => write(7));
		app.run(() => write(43));
		assert.equal(deepest.run(read), 7);
		assert.equal(sibling.run(read), 43);
		app.dispose();
		assert.equal(deepest.disposed, true);
		assert.equal(sibling.disposed, true);
	} finally {
		app.dispose();
	}
});

test('late context reaches an existing effect owner with its own context layer', () => {
	const app = root();
	const [read, write] = createContext<number>();
	const [readLocal, writeLocal] = createContext<number>();
	let child: core.Owner;
	try {
		app.run(() =>
			effect(() => {
				effect(() => {
					writeLocal(7);
					child = core.getOwner()!;
				});
			})
		);
		flushSync();
		const parent = child!.parent!;
		parent.run(() => write(42));
		assert.deepEqual(
			child!.run(() => [read(), readLocal()]),
			[42, 7]
		);
	} finally {
		app.dispose();
	}
});

test('sibling services release dependents before their dependencies', () => {
	const app = root();
	const released: number[] = [];
	for (let index = 0; index < 10; index++) {
		root(() => {
			onDestroy(() => released.push(index));
		}, app);
	}
	app.dispose();
	assert.deepEqual(released, [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);
});

test('owner failures reach the nearest live handler and leave siblings updating', () => {
	const app = root();
	const service = root(undefined, app);
	const nested = root(undefined, service);
	const input = cell(0);
	const errors: unknown[] = [];
	const outer: unknown[] = [];
	const original = new Error('effect');
	const escalated = new Error('handler');
	let shown = -1;
	let failed = 0;
	try {
		nested.run(() =>
			effect(() => {
				failed++;
				if (input.current < 2) throw original;
			})
		);
		app.onError((error) => outer.push(error));
		const remove = service.onError((error) => errors.push(error));
		app.run(() => effect(() => void (shown = input.current)));
		flushSync();
		assert.deepEqual(errors, [original]);
		assert.equal(shown, 0);
		flushSync();
		assert.equal(failed, 1);
		remove();
		input.current = 1;
		flushSync();
		assert.deepEqual(outer, [original]);
		assert.equal(shown, 1);
		const removeThrowing = service.onError(() => {
			throw escalated;
		});
		nested.run(
			() =>
				core.derived(() => {
					throw original;
				}).current
		);
		assert.deepEqual(outer, [original, escalated]);
		removeThrowing();
		input.current = 2;
		flushSync();
		assert.equal(shown, 2);
	} finally {
		app.dispose();
	}
});

test('a lazily obtained owner handles effects created before its handle', () => {
	const app = root();
	const error = new Error('existing child');
	const caught: unknown[] = [];
	try {
		app.run(() =>
			effect(() => {
				effect(() => {
					throw error;
				});
				core.getOwner()!.onError((failure) => caught.push(failure));
			})
		);
		flushSync();
		assert.deepEqual(caught, [error]);
	} finally {
		app.dispose();
	}
});

test('an unhandled owner failure still propagates and a removed handler stays removed', () => {
	const owner = root();
	const error = new Error('unhandled');
	try {
		const remove = owner.onError(() => {});
		remove();
		owner.run(() =>
			effect(() => {
				throw error;
			})
		);
		assert.throws(
			() => flushSync(),
			(caught) => caught === error
		);
	} finally {
		owner.dispose();
		flushSync();
	}
});

test('an owner signal cancels registered async work and each owner has its own lifetime', async () => {
	const app = root();
	const service = root(undefined, app);
	const signal = service.run(getAbortSignal);
	const [read, write] = createContext<number>();
	app.run(() => write(42));
	let cancelled = false;
	const done = service.start(async () => {
		await new Promise<void>((resolve) =>
			signal.addEventListener(
				'abort',
				() => {
					cancelled = true;
					resolve();
				},
				{ once: true }
			)
		);
		return signal.reason;
	});
	try {
		assert.equal(service.signal, signal);
		assert.equal(service.run(getAbortSignal), signal);
		assert.notEqual(app.signal, signal);
		service.dispose();
		await settled();
		assert.equal(cancelled, true);
		assert.equal((await done).name, 'StaleReactionError');
		assert.equal(service.signal, signal);
		assert.equal(app.signal.aborted, false);
		const value = await app.start(async () => {
			await Promise.resolve();
			return app.run(read);
		});
		assert.equal(value, 42);
	} finally {
		app.dispose();
	}
});
