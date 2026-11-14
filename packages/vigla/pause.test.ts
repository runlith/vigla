import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as core from 'vigla';

const { cell, derived, effect, flushSync, onDestroy, root, tick, watch } = core;

async function landed(): Promise<void> {
	await Promise.resolve();
}

test('a paused owner runs none of its effects, and a resumed one runs each stale effect once', async () => {
	const app = root();
	const input = cell(1);
	const other = cell('a');
	const log: string[] = [];
	try {
		const frame = app.root(() => {
			effect.pre(() => void log.push(`pre ${input.current}`));
			effect(() => void log.push(`post ${input.current}`));
			effect(() => void log.push(`other ${other.current}`));
		});
		flushSync();
		log.length = 0;
		frame.pause();
		await landed();
		assert.equal(frame.paused, true);
		input.current = 2;
		flushSync();
		input.current = 3;
		flushSync();
		assert.deepEqual(log, []);
		frame.resume();
		assert.equal(frame.paused, false);
		flushSync();
		assert.deepEqual(log, ['pre 3', 'post 3']);
		input.current = 4;
		flushSync();
		assert.deepEqual(log, ['pre 3', 'post 3', 'pre 4', 'post 4']);
	} finally {
		app.dispose();
	}
});

test('the flush that carries a pause still runs what the same change made due', async () => {
	const app = root();
	const shown = cell(true);
	const seen: boolean[] = [];
	try {
		const frame = app.root(() => {
			effect(() => void seen.push(shown.current));
		});
		app.run(() =>
			watch(
				() => shown.current,
				(now) => (now ? frame.resume() : frame.pause())
			)
		);
		flushSync();
		shown.current = false;
		flushSync();
		assert.deepEqual(seen, [true, false]);
		await landed();
		assert.equal(frame.paused, true);
		shown.current = true;
		flushSync();
		assert.deepEqual(seen, [true, false, true]);
		assert.equal(frame.paused, false);
	} finally {
		app.dispose();
	}
});

test('a resume before the pause lands leaves the owner running', async () => {
	const app = root();
	const input = cell(1);
	const seen: number[] = [];
	try {
		const frame = app.root(() => {
			effect(() => void seen.push(input.current));
		});
		flushSync();
		frame.pause();
		frame.resume();
		await landed();
		assert.equal(frame.paused, false);
		input.current = 2;
		flushSync();
		assert.deepEqual(seen, [1, 2]);
	} finally {
		app.dispose();
	}
});

test('a watch under a paused owner answers once on resume, against the value it last answered', async () => {
	const app = root();
	const input = cell(1);
	const seen: [number, number][] = [];
	try {
		const frame = app.root(() => {
			watch(
				() => input.current,
				(value, previous) => void seen.push([value, previous])
			);
		});
		flushSync();
		input.current = 2;
		flushSync();
		frame.pause();
		await landed();
		input.current = 3;
		flushSync();
		input.current = 4;
		flushSync();
		frame.resume();
		flushSync();
		assert.deepEqual(seen, [
			[2, 1],
			[4, 2]
		]);
		frame.pause();
		await landed();
		input.current = 5;
		flushSync();
		input.current = 4;
		flushSync();
		frame.resume();
		flushSync();
		assert.deepEqual(seen, [
			[2, 1],
			[4, 2]
		]);
	} finally {
		app.dispose();
	}
});

test('a derived of a paused owner still answers a reader outside it with current values', async () => {
	const app = root();
	const input = cell(1);
	try {
		let doubled: core.Cell<number> | undefined;
		const frame = app.root(() => {
			doubled = derived(() => input.current * 2);
		});
		frame.pause();
		await landed();
		input.current = 5;
		assert.equal(doubled!.current, 10);
	} finally {
		app.dispose();
	}
});

test('a paused child of a paused owner stays quiet until both are resumed', async () => {
	const app = root();
	const input = cell(1);
	const seen: number[] = [];
	try {
		let inner: core.Owner | undefined;
		const outer = app.root(() => {
			inner = core.getOwner()!.root(() => {
				effect(() => void seen.push(input.current));
			});
		});
		flushSync();
		outer.pause();
		inner!.pause();
		await landed();
		input.current = 2;
		flushSync();
		inner!.resume();
		flushSync();
		assert.deepEqual(seen, [1]);
		outer.resume();
		flushSync();
		assert.deepEqual(seen, [1, 2]);
	} finally {
		app.dispose();
	}
});

test('disposing a paused owner runs its teardowns and leaves the rest of the application running', async () => {
	const app = root();
	const input = cell(1);
	const log: string[] = [];
	try {
		const frame = app.root(() => {
			effect(() => {
				void input.current;
				return () => void log.push('cleanup');
			});
			onDestroy(() => void log.push('destroyed'));
		});
		app.run(() => effect(() => void log.push(`beside ${input.current}`)));
		flushSync();
		log.length = 0;
		frame.pause();
		await landed();
		frame.dispose();
		assert.deepEqual(log.toSorted(), ['cleanup', 'destroyed']);
		input.current = 2;
		flushSync();
		assert.deepEqual(log.slice(2), ['beside 2']);
	} finally {
		app.dispose();
	}
});

test('pausing an owner releases the update its pending work was holding', async () => {
	const app = root();
	const input = cell(1);
	const seen: number[] = [];
	let release!: () => void;
	const gate = new Promise<void>((resolve) => (release = resolve));
	const load = (value: number): number | Promise<number> =>
		value === 1 ? value : gate.then(() => value);
	try {
		const frame = app.root();
		const loaded = await frame.run(() => core.resource(() => load(input.current)));
		app.run(() => effect(() => void seen.push(input.current)));
		flushSync();
		input.current = 2;
		flushSync();
		assert.deepEqual(seen, [1]);
		frame.pause();
		await landed();
		await landed();
		assert.deepEqual(seen, [1, 2]);
		release();
		await tick();
		frame.resume();
		flushSync();
		await tick();
		assert.equal(loaded.current, 2);
	} finally {
		release();
		app.dispose();
	}
});
