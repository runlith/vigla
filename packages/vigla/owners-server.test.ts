import assert from 'node:assert/strict';
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
