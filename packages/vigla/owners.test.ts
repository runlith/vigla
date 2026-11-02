import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as core from 'vigla';
import { createSubscriber } from 'vigla/reactivity';

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

test('owned background work settles without holding writes, while an explicit hold does', async () => {
	const app = root();
	const status = cell('idle');
	const background = Promise.withResolvers<void>();
	const saving = Promise.withResolvers<void>();
	let shown = '';
	let quiet = false;
	try {
		app.run(() => effect(() => void (shown = status.current)));
		flushSync();
		status.current = 'loading';
		const work = app.start(() => background.promise);
		const waiting = app.settled().then(() => (quiet = true));
		await tick();
		assert.deepEqual([shown, quiet], ['loading', false]);
		status.current = 'saving';
		const held = app.run(() => core.hold(() => saving.promise));
		await tick();
		assert.equal(shown, 'loading');
		saving.resolve();
		await held;
		await tick();
		assert.deepEqual([shown, quiet], ['saving', false]);
		background.resolve();
		await work;
		await waiting;
		assert.equal(quiet, true);
	} finally {
		app.dispose();
	}
});

test('an owner settles once the work under it settles, whatever other owners still run', async () => {
	const app = root();
	const service = root(undefined, app);
	const other = root();
	const mine = Promise.withResolvers<void>();
	let quiet = false;
	try {
		void other.start(() => new Promise<void>(() => {}));
		void service.start(() => mine.promise);
		const waiting = app.settled().then(() => (quiet = true));
		await tick();
		assert.equal(quiet, false);
		mine.resolve();
		await waiting;
		assert.equal(quiet, true);
		void service.start(() => new Promise<void>(() => {}));
		const disposed = service.settled();
		service.dispose();
		await disposed;
	} finally {
		app.dispose();
		other.dispose();
	}
});

test('external sources and subscribers under a service owner release when it is disposed', async () => {
	const app = root();
	const service = root(undefined, app);
	const view = root();
	let subscriptions = 0;
	let started = 0;
	let emit = (_value: number): void => {};
	const source: core.Subscribable<number> = {
		subscribe(run) {
			subscriptions++;
			emit = run;
			run(1);
			return () => subscriptions--;
		}
	};
	const listen = createSubscriber(() => {
		started++;
		return () => started--;
	});
	const value = service.run(() => core.external(() => source));
	const doubled = service.run(() =>
		core.derived(() => {
			listen();
			return value.current * 2;
		})
	);
	let shown = 0;
	try {
		view.run(() => effect(() => void (shown = doubled.current)));
		flushSync();
		assert.deepEqual([shown, subscriptions, started], [2, 1, 1]);
		emit(2);
		flushSync();
		assert.equal(shown, 4);
		app.dispose();
		await Promise.resolve();
		assert.deepEqual([subscriptions, started], [0, 0]);
	} finally {
		view.dispose();
		app.dispose();
	}
});

test('deep state tracks nested writes, proxies assigned values and stays local to a deriving run', () => {
	const owner = root();
	const form = core.state<{ name: string; tags: string[] }>({ name: 'a', tags: [] });
	const seen: string[] = [];
	try {
		owner.run(() =>
			effect(() => void seen.push(`${form.current.name}:${form.current.tags.length}`))
		);
		flushSync();
		form.current.name = 'b';
		flushSync();
		form.current = { name: 'c', tags: [] };
		form.current.tags.push('x');
		flushSync();
		assert.deepEqual(seen, ['a:0', 'b:0', 'c:1']);
		const counted = core.derived(() => {
			const local = core.state({ count: 0 });
			local.current.count++;
			return local.current.count;
		});
		assert.equal(counted.current, 1);
	} finally {
		owner.dispose();
	}
});

test('tracking reports whether a reaction is reading', () => {
	const owner = root();
	const seen: boolean[] = [];
	try {
		owner.run(() =>
			effect(() => {
				seen.push(core.tracking(), core.untrack(core.tracking));
			})
		);
		flushSync();
		assert.deepEqual(
			[core.tracking(), owner.run(core.tracking), ...seen],
			[false, false, true, false]
		);
	} finally {
		owner.dispose();
	}
});

test('independent applications keep their own context, failures and lifetimes', () => {
	const [scope, setScope] = createContext<string>();
	const first = root();
	const second = root();
	const input = cell(0);
	const failure = new Error('first');
	const failures: unknown[] = [];
	const seen: string[] = [];
	try {
		first.run(() => setScope('first'));
		second.run(() => setScope('second'));
		first.onError((error) => failures.push(error));
		root(() => {
			effect(() => {
				if (input.current === 1) throw failure;
			});
		}, first);
		root(() => {
			effect(() => void seen.push(`${scope()} ${input.current}`));
		}, second);
		flushSync();
		input.current = 1;
		flushSync();
		first.dispose();
		input.current = 2;
		flushSync();
		assert.deepEqual(failures, [failure]);
		assert.deepEqual(seen, ['second 0', 'second 1', 'second 2']);
		assert.equal(second.disposed, false);
		assert.equal(second.run(scope), 'second');
	} finally {
		first.dispose();
		second.dispose();
	}
});
