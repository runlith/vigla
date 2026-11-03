import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as core from 'vigla';
import { createSubscriber } from 'vigla/reactivity';

const {
	cell,
	effect,
	root,
	tick,
	flushSync,
	onDestroy,
	createContext,
	getAbortSignal,
	settled,
	untrack
} = core;

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

test('a service outlives what was created after it under the same owner, siblings in creation order', () => {
	const app = root();
	const released: string[] = [];
	app.run(() => onDestroy(() => released.push('before')));
	const service = app.root(() => onDestroy(() => released.push('service')));
	app.run(() => {
		onDestroy(() => released.push(service.run(() => 'after')));
		onDestroy(() => released.push('last'));
	});
	app.dispose();
	assert.deepEqual(released, ['after', 'last', 'service', 'before']);
});

test('a service disposing an older sibling during release still leaves the oldest last', () => {
	const app = root();
	const released: string[] = [];
	const oldest = app.root(() => onDestroy(() => released.push('oldest')));
	const middle = app.root(() => onDestroy(() => released.push('middle')));
	app.root(() =>
		onDestroy(() => {
			released.push('newest');
			middle.dispose();
		})
	);
	app.dispose();
	assert.deepEqual(released, ['newest', 'middle', 'oldest']);
	assert.equal(oldest.disposed, true);
});

test('a disposal callback registered after disposal reads current values', () => {
	const done = root();
	done.dispose();
	const other = root();
	const value = cell(0);
	let seen = -1;
	other.run(() =>
		effect.pre(() => {
			void value.current;
			return () => done.onDispose(() => (seen = value.current));
		})
	);
	value.current = 1;
	other.dispose();
	flushSync();
	assert.equal(seen, 1);
});

test('owner disposal callbacks run once at disposal and can be withdrawn', () => {
	const app = root();
	const released: string[] = [];
	const withdraw = app.onDispose(() => released.push('withdrawn'));
	app.onDispose(() => released.push('kept'));
	withdraw();
	app.dispose();
	app.onDispose(() => released.push('late'));
	assert.deepEqual(released, ['kept', 'late']);
	assert.throws(() => onDestroy(() => {}), /teardown_without_owner/);
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
		assert.throws(
			() =>
				nested.run(
					() =>
						core.derived(() => {
							throw original;
						}).current
				),
			(thrown) => thrown === original
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

test('a derived keeps a handled failure for its readers until a dependency changes or an assignment publishes', async () => {
	const owner = root();
	const input = cell(0);
	const failure = new Error('derived');
	const handled: unknown[] = [];
	const value = owner.run(() =>
		core.derived(() => {
			if (input.current === 0) throw failure;
			return input.current;
		})
	);
	try {
		owner.onError((error) => handled.push(error));
		assert.throws(
			() => value.current,
			(thrown) => thrown === failure
		);
		assert.throws(
			() => value.current,
			(thrown) => thrown === failure
		);
		assert.deepEqual(handled, [failure]);
		core.fork(() => (value.current = 42)).discard();
		assert.throws(
			() => value.current,
			(thrown) => thrown === failure
		);
		await core.fork(() => (value.current = 42)).commit();
		assert.equal(value.current, 42);
		input.current = 1;
		assert.equal(value.current, 1);
		owner.dispose();
		input.current = 0;
		assert.throws(
			() => value.current,
			(thrown) => thrown === failure
		);
		assert.deepEqual(handled, [failure]);
	} finally {
		owner.dispose();
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

function hostReports(): [unknown[], () => void] {
	const reported: unknown[] = [];
	const host = globalThis as { reportError?: (error: unknown) => void };
	const previous = host.reportError;
	host.reportError = (error) => void reported.push(error);
	return [
		reported,
		() => {
			if (previous === undefined) delete host.reportError;
			else host.reportError = previous;
		}
	];
}

test('an unhandled failure leaves through the host, outside another application flush', () => {
	const owner = root();
	const other = root();
	const input = cell(0);
	const error = new Error('unhandled');
	const [reported, restore] = hostReports();
	let seen = -1;
	try {
		const remove = owner.onError(() => {});
		remove();
		owner.run(() =>
			effect(() => {
				if (input.current % 2 === 1) throw error;
			})
		);
		other.run(() => effect(() => void (seen = input.current)));
		flushSync();
		input.current = 1;
		other.run(() => flushSync());
		assert.deepEqual(reported, [error]);
		assert.equal(seen, 1);
		input.current = 3;
		root(() => flushSync()).dispose();
		assert.deepEqual(reported, [error, error]);
		const looping = cell(0);
		owner.run(() => effect(() => void (looping.current = looping.current + 1)));
		other.run(() => flushSync());
		assert.match(String(reported[2]), /effect_update_depth_exceeded/);
		assert.throws(
			() =>
				root(() => {
					throw error;
				}),
			(caught) => caught === error
		);
	} finally {
		restore();
		owner.dispose();
		other.dispose();
	}
});

test('one application settles and forks while another has pending work and writes', async () => {
	const first = root();
	const second = root();
	const busy = cell(0);
	const idle = cell(0);
	let quiet = false;
	try {
		first.run(() => effect(() => void busy.current));
		second.run(() => effect(() => void idle.current));
		flushSync();
		void first.start(() => new Promise<void>(() => {}));
		void second.run(settled).then(() => (quiet = true));
		await tick();
		assert.equal(quiet, true);
		busy.current = 1;
		second.run(() => core.fork(() => void (idle.current = 1))).discard();
		busy.current = 2;
		assert.throws(() => first.run(() => core.fork(() => {})), /fork_timing/);
	} finally {
		first.dispose();
		second.dispose();
		flushSync();
	}
});

test('settlement under an owner waits for the work a released hold resumes', async () => {
	const app = root();
	const go = cell(0);
	const gate = Promise.withResolvers<void>();
	const loaded = Promise.withResolvers<void>();
	let quiet = false;
	try {
		app.run(() =>
			effect(() => {
				if (go.current === 1) void app.start(() => loaded.promise);
			})
		);
		flushSync();
		const held = app.run(() =>
			core.hold(() => {
				go.current = 1;
				return gate.promise;
			})
		);
		const waiting = app.run(settled).then(() => (quiet = true));
		await tick();
		gate.resolve();
		await held;
		await tick();
		assert.equal(quiet, false);
		loaded.resolve();
		await waiting;
	} finally {
		app.dispose();
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

test('public effects return their disposal; a pre effect runs at once and an effect root outlives its caller', () => {
	const app = root();
	const [scope, setScope] = createContext<string>();
	const input = cell(0);
	const seen: string[] = [];
	app.run(() => setScope('app'));
	const stop = app.run(() => effect(() => void seen.push(`effect ${input.current}`)));
	const stopPre = app.run(() => effect.pre(() => void seen.push(`pre ${input.current}`)));
	const detached = app.run(() =>
		effect.root(() => effect(() => void seen.push(`root ${scope()} ${input.current}`)))
	);
	assert.deepEqual(seen, ['pre 0']);
	flushSync();
	stop();
	stopPre();
	app.dispose();
	input.current = 1;
	flushSync();
	detached();
	input.current = 2;
	flushSync();
	assert.deepEqual(seen.sort(), ['effect 0', 'pre 0', 'root app 0', 'root app 1']);
	assert.equal(Object.hasOwn(core, 'Owner'), false);
});

test('an owned resource publishes each run in its batch, and latest reads past the hold', async () => {
	const app = root();
	const id = cell(1);
	const loads = new Map<number, PromiseWithResolvers<string>>();
	let shown = '';
	let eager = 0;
	try {
		const first = app.run(() =>
			core.resource(() => {
				const load = Promise.withResolvers<string>();
				loads.set(id.current, load);
				return load.promise;
			})
		);
		loads.get(1)!.resolve('one');
		const value = await first;
		app.run(() =>
			effect(() => {
				shown = value.current;
				eager = core.latest(() => id.current);
			})
		);
		flushSync();
		id.current = 2;
		let quiet = false;
		const waiting = app.settled().then(() => (quiet = true));
		await tick();
		assert.deepEqual([shown, eager, quiet], ['one', 2, false]);
		loads.get(2)!.resolve('two');
		await waiting;
		await tick();
		assert.deepEqual([shown, eager], ['two', 2]);
		const copy = core.snapshot({ list: [1] });
		assert.deepEqual(copy, { list: [1] });
	} finally {
		app.dispose();
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

test('a held run that subscribes to another key leaves the committed run settled', async () => {
	const app = root();
	const path = cell('/start');
	const loads = new Map<string, { load: PromiseWithResolvers<string>; subscribe: () => void }>();
	const entry = (key: string) => {
		let found = loads.get(key);
		if (found === undefined) {
			found = { load: Promise.withResolvers<string>(), subscribe: createSubscriber(() => {}) };
			loads.set(key, found);
		}
		return found;
	};
	let runs = 0;
	try {
		entry('/start').load.resolve('start');
		const value = await app.run(() =>
			core.resource(() => {
				if (++runs > 10) return 'looping';
				const found = entry(path.current);
				found.subscribe();
				return found.load.promise;
			})
		);
		app.run(() => effect(() => void value.current));
		flushSync();
		path.current = '/next';
		await tick();
		assert.equal(runs, 2);
		entry('/next').load.resolve('next');
		await app.settled();
		assert.deepEqual([value.current, runs], ['next', 2]);
	} finally {
		app.dispose();
	}
});

test("a fork's evaluation of a derived leaves its committed effects and signal running", async () => {
	const app = root();
	const gate = cell(true);
	const pulse = cell(0);
	let runs = 0;
	let signal: AbortSignal | undefined;
	try {
		const value = app.run(() =>
			core.derived(() => {
				const open = gate.current;
				signal = getAbortSignal();
				effect(() => {
					void pulse.current;
					runs++;
				});
				return open ? 1 : 0;
			})
		);
		app.run(() => effect(() => void value.current));
		flushSync();
		const committed = signal!;
		core
			.fork(() => {
				gate.current = false;
				void value.current;
			})
			.discard();
		await tick();
		pulse.current = 1;
		flushSync();
		assert.deepEqual([committed.aborted, runs], [false, 2]);
	} finally {
		app.dispose();
	}
});

test("a fork's run keeps the subscription it replaced when discarded and replaces it when committed", async () => {
	const app = root();
	const path = cell<'a' | 'b'>('a');
	const raw = { a: 1, b: 10 };
	const live = new Set<string>();
	const emits = { a: (): void => {}, b: (): void => {} };
	const watch = (key: 'a' | 'b') =>
		createSubscriber((update) => {
			live.add(key);
			emits[key] = update;
			return () => {
				live.delete(key);
				emits[key] = () => {};
			};
		});
	const subscribers = { a: watch('a'), b: watch('b') };
	let shown = 0;
	try {
		const value = await app.run(() =>
			core.resource(() => {
				const key = path.current;
				subscribers[key]();
				return Promise.resolve(raw[key]);
			})
		);
		app.run(() => effect(() => void (shown = value.current)));
		flushSync();
		const discarded = core.fork(() => (path.current = 'b'));
		await tick();
		discarded.discard();
		await tick();
		raw.a = 2;
		emits.a();
		await app.settled();
		assert.deepEqual([[...live], shown], [['a'], 2]);
		const committed = core.fork(() => (path.current = 'b'));
		await tick();
		await committed.commit();
		raw.b = 20;
		emits.b();
		await app.settled();
		assert.deepEqual([[...live], shown], [['b'], 20]);
	} finally {
		app.dispose();
	}
});

test('a discarded fork leaves the request of a pending run in flight', async () => {
	const app = root();
	const path = cell('a');
	const loads = new Map<string, PromiseWithResolvers<string>>();
	let shown = '';
	try {
		const value = await app.run(() =>
			core.resource(() => {
				const key = path.current;
				const signal = getAbortSignal();
				if (key === 'a') return 'a';
				const load = Promise.withResolvers<string>();
				loads.set(key, load);
				signal.addEventListener('abort', () => load.reject(signal.reason));
				return load.promise;
			})
		);
		app.run(() => effect(() => void (shown = value.current)));
		flushSync();
		path.current = 'b';
		await tick();
		core.fork(() => (path.current = 'c')).discard();
		loads.get('b')!.resolve('b');
		await new Promise((done) => setTimeout(done));
		assert.equal(shown, 'b');
	} finally {
		app.dispose();
	}
});

test("a fork's run releases the services of the run it replaces newest first", async () => {
	const app = root();
	const path = cell('a');
	const log: string[] = [];
	try {
		const value = await app.run(() =>
			core.resource(() => {
				const key = path.current;
				const owner = core.getOwner()!;
				owner.root(() => () => log.push(`${key} first`));
				owner.root(() => () => log.push(`${key} second`));
				return key;
			})
		);
		app.run(() => effect(() => void value.current));
		flushSync();
		const discarded = core.fork(() => (path.current = 'b'));
		await tick();
		discarded.discard();
		const committed = core.fork(() => (path.current = 'b'));
		await tick();
		await committed.commit();
		assert.deepEqual(log, ['b second', 'b first', 'a second', 'a first']);
	} finally {
		app.dispose();
	}
});

test("a fork's run owns the effects of the deriveds it creates", async () => {
	const app = root();
	const path = cell('a');
	const live = new Set<string>();
	try {
		const value = await app.run(() =>
			core.resource(() => {
				const key = path.current;
				const local = core.derived(() => {
					core.effect.pre(() => {
						live.add(key);
						return () => live.delete(key);
					});
					return key;
				});
				return untrack(() => local.current);
			})
		);
		app.run(() => effect(() => void value.current));
		flushSync();
		const discarded = core.fork(() => (path.current = 'b'));
		await tick();
		discarded.discard();
		await tick();
		assert.deepEqual([...live], ['a']);
		const committed = core.fork(() => (path.current = 'b'));
		await tick();
		await committed.commit();
		assert.deepEqual([...live], ['b']);
	} finally {
		app.dispose();
	}
});

test("a discarded fork's cancelled request leaves none of its reads behind", async () => {
	const app = root();
	const path = cell<'a' | 'b'>('a');
	const inputs = { a: cell(1), b: cell(1) };
	const requests: string[] = [];
	try {
		const value = await app.run(() =>
			core.resource(() => {
				const key = path.current;
				const input = inputs[key].current;
				const signal = getAbortSignal();
				requests.push(`${key}${input}`);
				if (key === 'a') return input;
				return new Promise<number>((_, reject) =>
					signal.addEventListener('abort', () => reject(signal.reason))
				);
			})
		);
		app.run(() => effect(() => void value.current));
		flushSync();
		core.fork(() => (path.current = 'b')).discard();
		await tick();
		inputs.a.current = 2;
		await app.settled();
		inputs.b.current = 2;
		await app.settled();
		assert.deepEqual(requests, ['a1', 'b1', 'a2']);
	} finally {
		app.dispose();
	}
});

test("a committed fork's evaluation of a derived nobody reads any more holds no resources", async () => {
	const app = root();
	const view = app.root();
	const input = cell(0);
	const live = new Set<number>();
	const signals: AbortSignal[] = [];
	try {
		const value = app.run(() =>
			core.derived(() => {
				const current = input.current;
				signals.push(getAbortSignal());
				core.effect.pre(() => {
					live.add(current);
					return () => live.delete(current);
				});
				return current;
			})
		);
		await view.run(() => core.resource(() => value.current));
		flushSync();
		const committed = core.fork(() => (input.current = 1));
		await tick();
		view.dispose();
		await committed.commit();
		assert.deepEqual([[...live], signals.map((signal) => signal.aborted)], [[], [true, true]]);
	} finally {
		app.dispose();
	}
});

test("a derived read again while a fork's commit releases its evaluation keeps its newest signal", async () => {
	const app = root();
	const view = app.root();
	const input = cell(0);
	const signals: AbortSignal[] = [];
	try {
		const value: core.Cell<number> = app.run(() =>
			core.derived(() => {
				const current = input.current;
				const signal = getAbortSignal();
				if (signals.length === 0)
					signal.addEventListener('abort', () => void core.latest(() => value.current));
				signals.push(signal);
				return current;
			})
		);
		await view.run(() => core.resource(() => value.current));
		flushSync();
		const committed = core.fork(() => (input.current = 1));
		await tick();
		await committed.commit();
		view.dispose();
		assert.deepEqual(
			signals.map((signal) => signal.aborted),
			[true, true, true]
		);
	} finally {
		app.dispose();
	}
});
