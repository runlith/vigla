import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as core from 'vigla';

const { cell, effect, flushSync, getAbortSignal, root, state, watch } = core;

test('a watch stays silent at creation and answers each change with the value before it', () => {
	const owner = root();
	const input = cell(1);
	const seen: [number, number][] = [];
	try {
		owner.run(() =>
			watch(
				() => input.current,
				(value, previous) => void seen.push([value, previous])
			)
		);
		flushSync();
		assert.deepEqual(seen, []);
		input.current = 2;
		flushSync();
		input.current = 5;
		flushSync();
		assert.deepEqual(seen, [
			[2, 1],
			[5, 2]
		]);
	} finally {
		owner.dispose();
	}
});

test('a change written before the first flush is answered against the value at creation', () => {
	const owner = root();
	const input = cell('a');
	const seen: [string, string][] = [];
	try {
		owner.run(() =>
			watch(
				() => input.current,
				(value, previous) => void seen.push([value, previous])
			)
		);
		input.current = 'b';
		flushSync();
		assert.deepEqual(seen, [['b', 'a']]);
	} finally {
		owner.dispose();
	}
});

test('an immediate watch answers the first value with no previous one', () => {
	const owner = root();
	const input = cell(1);
	const seen: [number, number | undefined][] = [];
	try {
		owner.run(() =>
			watch(
				() => input.current,
				(value, previous) => void seen.push([value, previous]),
				{
					immediate: true
				}
			)
		);
		flushSync();
		input.current = 2;
		flushSync();
		assert.deepEqual(seen, [
			[1, undefined],
			[2, 1]
		]);
	} finally {
		owner.dispose();
	}
});

test('an immediate watch.pre answers during its own creation', () => {
	const owner = root();
	const input = cell(1);
	const seen: number[] = [];
	try {
		owner.run(() =>
			watch.pre(
				() => input.current,
				(value) => void seen.push(value),
				{ immediate: true }
			)
		);
		assert.deepEqual(seen, [1]);
		input.current = 2;
		flushSync();
		assert.deepEqual(seen, [1, 2]);
	} finally {
		owner.dispose();
	}
});

test('what the handler reads never reruns it', () => {
	const owner = root();
	const input = cell(1);
	const other = cell(10);
	const seen: number[] = [];
	try {
		owner.run(() =>
			watch(
				() => input.current,
				(value) => void seen.push(value + other.current)
			)
		);
		flushSync();
		other.current = 20;
		flushSync();
		assert.deepEqual(seen, []);
		input.current = 2;
		flushSync();
		other.current = 30;
		flushSync();
		assert.deepEqual(seen, [22]);
	} finally {
		owner.dispose();
	}
});

test('a handler may write what it reads without looping', () => {
	const owner = root();
	const input = cell(1);
	const total = cell(0);
	try {
		owner.run(() =>
			watch(
				() => input.current,
				(value) => void (total.current = total.current + value)
			)
		);
		flushSync();
		input.current = 2;
		flushSync();
		input.current = 3;
		flushSync();
		assert.equal(total.current, 5);
	} finally {
		owner.dispose();
	}
});

test('a tuple source is compared element by element', () => {
	const owner = root();
	const size = cell(1);
	const name = cell('a');
	const seen: [boolean, string][] = [];
	try {
		owner.run(() =>
			watch(
				() => [size.current > 0, name.current] as [boolean, string],
				(value) => void seen.push(value)
			)
		);
		flushSync();
		size.current = 2;
		flushSync();
		assert.deepEqual(seen, []);
		name.current = 'b';
		flushSync();
		size.current = 0;
		flushSync();
		assert.deepEqual(seen, [
			[true, 'b'],
			[false, 'b']
		]);
	} finally {
		owner.dispose();
	}
});

test('equals decides what counts as a change', () => {
	const owner = root();
	const place = cell({ project: 1, branch: 'main' });
	const seen: number[] = [];
	try {
		owner.run(() =>
			watch(
				() => place.current,
				(value) => void seen.push(value.project),
				{ equals: (previous, value) => previous.project === value.project }
			)
		);
		flushSync();
		place.current = { project: 1, branch: 'other' };
		flushSync();
		assert.deepEqual(seen, []);
		place.current = { project: 2, branch: 'other' };
		flushSync();
		assert.deepEqual(seen, [2]);
	} finally {
		owner.dispose();
	}
});

test('a field of deep state is watched by reading it', () => {
	const owner = root();
	const held = state({ count: 0, label: 'a' });
	const seen: number[] = [];
	try {
		owner.run(() =>
			watch(
				() => held.current.count,
				(value) => void seen.push(value)
			)
		);
		flushSync();
		held.current.label = 'b';
		flushSync();
		held.current.count = 1;
		flushSync();
		assert.deepEqual(seen, [1]);
	} finally {
		owner.dispose();
	}
});

test('the cleanup a handler returns runs before the next answer and when the watch ends', () => {
	const owner = root();
	const input = cell(1);
	const log: string[] = [];
	try {
		const stop = owner.run(() =>
			watch(
				() => input.current,
				(value) => {
					log.push(`run ${value}`);
					return () => void log.push(`clean ${value}`);
				}
			)
		);
		flushSync();
		input.current = 2;
		flushSync();
		input.current = 3;
		flushSync();
		assert.deepEqual(log, ['run 2', 'clean 2', 'run 3']);
		stop();
		assert.deepEqual(log, ['run 2', 'clean 2', 'run 3', 'clean 3']);
		input.current = 4;
		flushSync();
		assert.deepEqual(log, ['run 2', 'clean 2', 'run 3', 'clean 3']);
	} finally {
		owner.dispose();
	}
});

test("a handler's abort signal ends with the next change and with the owner", () => {
	const owner = root();
	const input = cell(1);
	const signals: AbortSignal[] = [];
	owner.run(() =>
		watch(
			() => input.current,
			() => void signals.push(getAbortSignal())
		)
	);
	flushSync();
	input.current = 2;
	flushSync();
	assert.equal(signals[0]!.aborted, false);
	input.current = 3;
	flushSync();
	assert.equal(signals[0]!.aborted, true);
	assert.equal(signals[1]!.aborted, false);
	owner.dispose();
	assert.equal(signals[1]!.aborted, true);
});

test('several writes in one flush are answered once with the last value', () => {
	const owner = root();
	const input = cell(1);
	const seen: [number, number][] = [];
	try {
		owner.run(() =>
			watch(
				() => input.current,
				(value, previous) => void seen.push([value, previous])
			)
		);
		flushSync();
		input.current = 2;
		input.current = 3;
		input.current = 4;
		flushSync();
		assert.deepEqual(seen, [[4, 1]]);
	} finally {
		owner.dispose();
	}
});

test('a watch created while an effect runs does not subscribe that effect to its source', () => {
	const owner = root();
	const input = cell(1);
	let runs = 0;
	try {
		owner.run(() =>
			effect(() => {
				runs++;
				watch(
					() => input.current,
					() => {}
				);
			})
		);
		flushSync();
		input.current = 2;
		flushSync();
		assert.equal(runs, 1);
	} finally {
		owner.dispose();
	}
});

test('a watch with no owner is refused', () => {
	assert.throws(
		() =>
			watch(
				() => 0,
				() => {}
			),
		/effect_orphan/
	);
	assert.throws(
		() =>
			watch.pre(
				() => 0,
				() => {}
			),
		/effect_orphan/
	);
});
