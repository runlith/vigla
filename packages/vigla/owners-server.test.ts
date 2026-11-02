import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as core from 'vigla';

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
