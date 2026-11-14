import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { test } from 'node:test';
import * as core from 'vigla';
import { render, type Component } from 'vigla/server';

function gate(): [Promise<void>, () => void] {
	let open!: () => void;
	const opened = new Promise<void>((resolve) => (open = resolve));
	return [opened, open];
}

test('a server owner memoizes its derived under the declaring context and accepts overrides', () => {
	const owner = core.root();
	const [read, write] = core.createContext<number>();
	owner.run(() => write(42));
	let runs = 0;
	const value = owner.run(() =>
		core.derived(() => {
			runs++;
			return read();
		})
	);
	try {
		assert.equal(value.current, 42);
		assert.equal(value.current, 42);
		assert.equal(runs, 1);
		value.current = 7;
		assert.equal(value.current, 7);
	} finally {
		owner.dispose();
	}
});

test('an owned server derived follows the cells and derived values it read', () => {
	const owner = core.root();
	const user = core.cell('ada');
	try {
		const name = owner.run(() => core.derived(() => user.current.toUpperCase()));
		const initial = owner.run(() => core.derived(() => name.current[0]));
		assert.equal(initial.current, 'A');
		initial.current = 'Z';
		assert.equal(initial.current, 'Z');
		user.current = 'grace';
		assert.deepEqual([name.current, initial.current], ['GRACE', 'G']);
	} finally {
		owner.dispose();
	}
});

test('an owned server derived follows every external emission and ignores reads outside its tracking', () => {
	const owner = core.root();
	const service = core.root();
	const items = [1];
	const listeners = new Set<(value: number[]) => void>();
	const source = {
		subscribe(listener: (value: number[]) => void) {
			listener(items);
			listeners.add(listener);
			return () => listeners.delete(listener);
		}
	};
	const ignored = core.cell(1);
	try {
		const list = owner.run(() => core.external(() => source));
		const peeked = owner.run(() => core.external(() => (ignored.current ? source : null)));
		const size = owner.run(() =>
			core.derived(
				() =>
					list.current.length +
					peeked.peek!.length +
					core.untrack(() => ignored.current) +
					service.run(() => ignored.current)
			)
		);
		assert.equal(size.current, 4);
		ignored.current = 5;
		assert.equal(size.current, 4);
		items.push(2);
		for (const listener of listeners) listener(items);
		assert.equal(size.current, 14);
	} finally {
		owner.dispose();
		service.dispose();
	}
});

test('a server derived keeps a handled failure for its readers until a dependency changes or an assignment publishes', () => {
	const owner = core.root();
	const input = core.cell(0);
	const failure = new Error('derived');
	const handled: unknown[] = [];
	const thrown = (caught: unknown): boolean => caught === failure;
	const value = owner.run(() =>
		core.derived(() => {
			if (input.current === 0) throw failure;
			return input.current;
		})
	);
	const doubled = owner.run(() => core.derived(() => value.current * 2));
	try {
		owner.onError((error) => handled.push(error));
		assert.throws(() => doubled.current, thrown);
		assert.throws(() => value.current, thrown);
		assert.deepEqual(handled, [failure, failure]);
		value.current = 5;
		assert.equal(doubled.current, 10);
		input.current = 1;
		assert.equal(doubled.current, 2);
		owner.dispose();
		input.current = 0;
		assert.throws(() => value.current, thrown);
		assert.deepEqual(handled, [failure, failure]);
	} finally {
		owner.dispose();
	}
});

test('a server derived that read an unhandled failure recovers with its source', () => {
	const owner = core.root();
	const input = core.cell(0);
	const other = core.cell(0);
	const failure = new Error('derived');
	const thrown = (caught: unknown): boolean => caught === failure;
	const source = (): number => {
		if (input.current === 0) throw failure;
		return 1;
	};
	const owned = owner.run(() => core.derived(source));
	const unowned = core.derived(source);
	const fromOwned = owner.run(() => core.derived(() => owned.current * 2));
	const fromUnowned = owner.run(() => core.derived(() => other.current + unowned.current));
	try {
		assert.throws(() => fromOwned.current, thrown);
		input.current = 1;
		assert.deepEqual([fromOwned.current, fromUnowned.current], [2, 1]);
		input.current = 0;
		other.current = 1;
		assert.throws(() => fromUnowned.current, thrown);
		input.current = 1;
		assert.equal(fromUnowned.current, 2);
	} finally {
		owner.dispose();
	}
});

test('a server derived declared outside owners does not cache a request context', () => {
	const [read, write] = core.createContext<number>();
	const value = core.derived(read);
	const first = core.root(() => {
		write(1);
	});
	const second = core.root(() => {
		write(2);
	});
	try {
		assert.equal(
			first.run(() => value.current),
			1
		);
		assert.equal(
			second.run(() => value.current),
			2
		);
	} finally {
		first.dispose();
		second.dispose();
	}
});

test('server deep state keeps plain values and nothing tracks', () => {
	const value = { name: 'a' };
	const form = core.state(value);
	form.current.name = 'b';
	assert.equal(form.current, value);
	form.current = { name: 'c' };
	assert.deepEqual([form.current.name, core.tracking()], ['c', false]);
});

test('server owner work and holds count toward owner and global settlement', async () => {
	const owner = core.root();
	const other = core.root();
	const [started, finish] = gate();
	const [holding, release] = gate();
	const quiet: string[] = [];
	try {
		const work = owner.start(() => started);
		const held = owner.run(() => core.hold(() => holding));
		void owner.settled().then(() => quiet.push('owner'));
		void core.settled().then(() => quiet.push('all'));
		void other.run(core.settled).then(() => quiet.push('other'));
		await new Promise((resolve) => setTimeout(resolve));
		finish();
		await work;
		assert.deepEqual(quiet, ['other']);
		release();
		await held;
		await new Promise((resolve) => setTimeout(resolve));
		assert.deepEqual(quiet.sort(), ['all', 'other', 'owner']);
	} finally {
		owner.dispose();
		other.dispose();
	}
});

test('server teardowns outside an owner are refused and services outlive later teardowns', () => {
	const app = core.root();
	const released: string[] = [];
	const service = app.root(() => core.onDestroy(() => released.push('service')));
	app.onDispose(() => released.push(service.run(() => 'after')));
	app.dispose();
	assert.deepEqual(released, ['after', 'service']);
	assert.throws(() => core.onDestroy(() => {}), /teardown_without_owner/);
});

test('server public effects never run and a server resource settles under its owner', async () => {
	const owner = core.root();
	const [loading, load] = gate();
	let ran = false;
	try {
		const disposals = owner.run(() => [
			core.effect(() => void (ran = true)),
			core.effect.pre(() => void (ran = true)),
			core.effect.root(() => void (ran = true))
		]);
		for (const dispose of disposals) dispose();
		const resource = owner.run(() => core.resource(() => loading.then(() => 'value')));
		let quiet = false;
		void owner.settled().then(() => (quiet = true));
		await Promise.resolve();
		assert.equal(quiet, false);
		load();
		assert.equal((await resource).current, 'value');
		await owner.settled();
		assert.deepEqual(
			[ran, core.pending(), core.latest(() => 1), core.snapshot({ a: [1] })],
			[false, 0, 1, { a: [1] }]
		);
		assert.equal(Object.hasOwn(core, 'Owner'), false);
	} finally {
		owner.dispose();
	}
});

test('server child owners see context installed after their creation and own their signals', () => {
	const parent = core.root();
	const child = core.root(undefined, parent);
	const [read, write] = core.createContext<number>();
	try {
		parent.run(() => write(42));
		assert.equal(child.run(read), 42);
		const signal = child.run(core.getAbortSignal);
		assert.equal(child.signal, signal);
		assert.notEqual(parent.signal, signal);
		parent.dispose();
		assert.equal(signal.aborted, true);
		assert.equal(signal.reason.name, 'StaleReactionError');
	} finally {
		parent.dispose();
	}
});

test('a request carries context into render and its disposal ends the render beneath it', async () => {
	const request = core.root();
	const [user, setUser] = core.createContext<string>();
	const released: string[] = [];
	const [pending, resume] = gate();
	request.run(() => setUser('ada'));
	core.root(() => core.onDestroy(() => released.push('service')), request);
	let owner!: core.Owner;
	let signal!: AbortSignal;
	let child!: core.Owner;
	const rendering = request.run(() =>
		render((out) => {
			out.push(`<p>${user()}</p>`);
			owner = core.getOwner()!;
			signal = core.getAbortSignal();
			core.onDestroy(() => released.push('render'));
			child = core.root(() => core.onDestroy(() => released.push('child')), owner);
			out.child(() => pending);
		})
	);
	assert.equal(owner.parent, request);
	assert.deepEqual(released, []);
	request.dispose();
	assert.deepEqual(released, ['child', 'render', 'service']);
	assert.deepEqual([owner.disposed, child.disposed, signal.aborted], [true, true, true]);
	resume();
	assert.match((await rendering).body, /<p>ada<\/p>/);
});

test('a throwing child owner teardown neither skips component teardowns nor hides a render failure', () => {
	const cleanup = new Error('cleanup');
	const failure = new Error('render');
	const released: string[] = [];
	const page = (fails: boolean) => () => {
		core.onDestroy(() => released.push('render'));
		core.root(
			() =>
				core.onDestroy(() => {
					throw cleanup;
				}),
			core.getOwner()
		);
		if (fails) throw failure;
	};
	assert.throws(
		() => render(page(false)),
		(error) => error === cleanup
	);
	assert.throws(
		() => render(page(true)),
		(error) => error === failure
	);
	assert.deepEqual(released, ['render', 'render']);
});

test('hydration opened on the render owner is the store the render serializes', async () => {
	const shown = await render((out) => {
		core.openHydration();
		out.push(String(core.hydratable('opened', () => 42)));
	});
	assert.match(shown.head, /\["opened",42\]/);
});

test('independent server applications keep their own context, hydration data and lifetimes', async () => {
	const [scope, setScope] = core.createContext<string>();
	const first = core.root();
	const second = core.root();
	const [pending, resume] = gate();
	const owners: core.Owner[] = [];
	const signals: AbortSignal[] = [];
	const page = (key: string) => (out: Parameters<Component>[0]) => {
		owners.push(core.getOwner()!);
		signals.push(core.getAbortSignal());
		core.hydratable(key, () => scope());
		out.push(scope());
		out.child(() => pending);
	};
	try {
		first.run(() => {
			setScope('first');
			core.openHydration();
		});
		second.run(() => {
			setScope('second');
			core.openHydration();
		});
		const firstPage = first.run(() => render(page('first')));
		const secondPage = second.run(() =>
			render((out) => {
				page('second')(out);
				out.push(first.run(() => `/${scope()}:${core.hydratable('shared', () => 1)}`));
			})
		);
		first.dispose();
		assert.deepEqual(
			[owners[0]!.disposed, signals[0]!.aborted, owners[1]!.disposed, signals[1]!.aborted],
			[true, true, false, false]
		);
		resume();
		const shown = await secondPage;
		assert.match(shown.body, /second.*\/first:1/);
		assert.match(shown.head, /\["second","second"\]/);
		assert.doesNotMatch(shown.head, /"first"|"shared"/);
		assert.doesNotMatch((await firstPage).head, /"second"/);
	} finally {
		first.dispose();
		second.dispose();
	}
});

test('an installed async store carries the owner and async variables across await, one store per realm', async () => {
	const request = core.root();
	const variable = new core.AsyncVariable<string>();
	const [read, write] = core.createContext<string>();
	request.run(() => write('ada'));
	const continued = (value: string) =>
		request.run(() =>
			variable.run(value, async () => {
				await null;
				return [core.getOwner(), variable.get()];
			})
		);
	assert.deepEqual(await continued('plain'), [null, undefined]);
	const store = new AsyncLocalStorage();
	core.carryAcrossAwait(store);
	core.carryAcrossAwait(store);
	assert.throws(() => core.carryAcrossAwait(new AsyncLocalStorage()), /async_store_conflict/);
	assert.deepEqual(await continued('carried'), [request, 'carried']);
	const released: string[] = [];
	const owned = await request.run(async () => {
		await null;
		core.onDestroy(() => released.push('teardown'));
		return [read(), core.derived(read).current];
	});
	assert.deepEqual(owned, ['ada', 'ada']);
	request.dispose();
	assert.deepEqual(released, ['teardown']);
});

test('a server watch reads no source and answers nothing, as server effects do', () => {
	const owner = core.root();
	let calls = 0;
	const count = (): number => ++calls;
	try {
		const stops = owner.run(() => [
			core.watch(count, count, { immediate: true }),
			core.watch.pre(count, count, { immediate: true })
		]);
		for (const stop of stops) stop();
		assert.equal(calls, 0);
	} finally {
		owner.dispose();
	}
});
