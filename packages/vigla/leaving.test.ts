import assert from 'node:assert/strict';
import { test } from 'node:test';
import { work } from './src/runtime/reactivity/async.ts';
import { atCommit, Batch, skip, unskip, within } from './src/runtime/reactivity/batch.ts';
import { leaving, stayed } from './src/runtime/reactivity/leaving.ts';
import { flushSync, process } from './src/runtime/reactivity/scheduler.ts';
import {
	branch,
	block,
	destroy,
	destroyed,
	hide,
	root,
	show,
	teardown
} from './src/runtime/reactivity/effects.ts';
import { getAbortSignal } from './src/runtime/reactivity/effects.ts';
import { proxy } from './src/runtime/reactivity/proxy.ts';
import { fork } from './src/runtime/reactivity/fork.ts';
import type { Derived, Effect } from './src/runtime/reactivity/graph.ts';
import { ownerOf } from './src/runtime/reactivity/owners.ts';
import { derived, memo, set, state, type Cell } from './src/runtime/reactivity/sources.ts';
import { get } from './src/runtime/reactivity/reads.ts';
import { untrack } from './src/runtime/reactivity/tracking.ts';

test('an outgoing derived keeps one transitive view and local state without publishing its cache', () => {
	const value = state(1);
	const visible = state(true);
	const outer = derived(() => get(value) * 10);
	let child!: Effect;
	let selected!: Derived<number>;
	let local!: Derived<number>;
	let end!: () => boolean;
	const cleanups: number[] = [];
	const direct = derived(() => get(selected));
	const tree = root(() => {
		child = branch(() => {
			selected = derived(() => get(outer) + get(value));
			local = derived(() => {
				const own = state(0);
				const nested = derived(() => get(own) + get(value));
				get(nested);
				set(own, 2);
				teardown(() => {
					cleanups.push(get(value));
				});
				return get(nested);
			});
		});
		block(() => {
			if (!get(visible))
				atCommit({
					apply() {
						end = leaving(child);
					}
				});
		});
	});
	try {
		flushSync(() => {
			set(value, 2);
			set(visible, false);
		});
		assert.equal(get(selected), 11);
		assert.equal(get(outer), 20);
		assert.equal(get(direct), 22);
		assert.equal(get(selected), 11);
		assert.equal(get(local), 3);
		flushSync(() => set(value, 3));
		assert.equal(get(selected), 11);
		assert.equal(get(local), 3);
		assert.equal(end(), true);
		assert.equal(end(), false);
		assert.deepEqual(cleanups, [3]);
		assert.equal(get(selected), 33);
	} finally {
		destroy(tree);
		flushSync();
	}
});

test('an outgoing public derived rethrows a failure its owner handled without evaluating again', () => {
	const value = state(0);
	const visible = state(true);
	const failure = new Error('outgoing');
	const handled: unknown[] = [];
	let runs = 0;
	let child!: Effect;
	let seen!: Cell<number>;
	let unseen!: Cell<number>;
	let end!: () => boolean;
	const failing = (): number => {
		runs++;
		if (get(value) === 0) throw failure;
		return get(value);
	};
	const tree = root(() => {
		child = branch(() => {
			seen = memo(failing);
			unseen = memo(failing);
		});
		block(() => {
			if (!get(visible))
				atCommit({
					apply() {
						end = leaving(child);
					}
				});
		});
	});
	const thrown = (caught: unknown): boolean => caught === failure;
	try {
		ownerOf(child).onError((error) => handled.push(error));
		assert.throws(() => seen.current, thrown);
		flushSync(() => set(visible, false));
		for (let read = 0; read < 2; read++) {
			assert.throws(() => seen.current, thrown);
			assert.throws(() => unseen.current, thrown);
		}
		assert.deepEqual([runs, handled.length], [2, 2]);
		end();
	} finally {
		destroy(tree);
		flushSync();
	}
});

test('a leaving view includes writes concealed by a held batch even when its commit writes nothing', () => {
	const value = state(0);
	const visible = state(true);
	let child!: Effect;
	let selected!: Derived<number>;
	let end!: () => boolean;
	const tree = root(() => {
		child = branch(() => {
			selected = derived(() => get(value));
		});
		block(() => {
			if (!get(visible))
				atCommit({
					apply() {
						end = leaving(child);
					}
				});
		});
	});
	let settle!: () => void;
	const held = new Batch();
	try {
		within(held, () => {
			set(value, 1);
			settle = work();
		});
		process(held);
		flushSync(() => set(visible, false));
		assert.equal(get(selected), 0);
		settle();
		flushSync();
		assert.equal(get(value), 1);
		assert.equal(get(selected), 0);
		end();
		assert.equal(get(selected), 1);
	} finally {
		settle();
		destroy(tree);
		flushSync();
	}
});

test('merged commit callbacks seed the combined batch and fork apply preserves older outgoing views', async () => {
	const value = state(0);
	const visible = state(true);
	let child!: Effect;
	let selected!: Derived<number>;
	let end!: () => boolean;
	const tree = root(() => {
		child = branch(() => {
			selected = derived(() => get(value));
		});
		block(() => {
			if (!get(visible))
				atCommit({
					apply() {
						end ??= leaving(child);
					}
				});
		});
	});
	let settle!: () => void;
	const held = new Batch();
	try {
		within(held, () => {
			set(value, 1);
			settle = work();
		});
		process(held);
		flushSync(() => {
			set(value, 2);
			set(visible, false);
		});
		assert.equal(typeof end, 'undefined');
		settle();
		flushSync();
		assert.equal(get(value), 2);
		assert.equal(get(selected), 0);
		const staged = fork(() => set(value, 4));
		assert.equal(get(value), 2);
		assert.equal(get(selected), 0);
		await staged.commit();
		assert.equal(get(value), 4);
		assert.equal(get(selected), 0);
		stayed(child);
		assert.equal(end?.(), false);
		assert.equal(get(selected), 4);
	} finally {
		settle();
		destroy(tree);
		flushSync();
	}
});

test('a held selection runs in its own view while unowned outgoing readers keep their prior view', () => {
	const value = state(0);
	const visible = state(true);
	let child!: Effect;
	let selected!: Derived<number>;
	const seen: number[] = [];
	const tree = root(() => {
		block(() => {
			if (!get(visible)) {
				skip(child);
				atCommit({
					apply() {
						hide(child);
						leaving(child);
					}
				});
			} else if (child !== undefined) {
				unskip(child);
				atCommit({
					apply() {
						stayed(child);
						show(child);
					}
				});
			}
		});
		child = branch(() => {
			selected = derived(() => get(value));
			block(() => {
				seen.push(get(selected));
			});
		});
	});
	let settle!: () => void;
	try {
		flushSync(() => {
			set(value, 1);
			set(visible, false);
		});
		assert.equal(get(selected), 0);
		const held = new Batch();
		within(held, () => {
			set(value, 2);
			set(visible, true);
			settle = work();
		});
		process(held);
		flushSync();
		assert.deepEqual(seen, [0, 2]);
		assert.equal(get(selected), 0);
		settle();
		flushSync();
		assert.equal(get(selected), 2);
	} finally {
		settle?.();
		destroy(tree);
		flushSync();
	}
});

test('ending nested epochs in either order preserves first late reads and a replacement lifetime', () => {
	const value = state(0);
	let outer!: Effect;
	let inner!: Effect;
	let readOuter!: Derived<number>;
	let readInner!: Derived<number>;
	const tree = root(() => {
		outer = branch(() => {
			readOuter = derived(() => get(value));
			inner = branch(() => {
				readInner = derived(() => get(value));
			});
		});
	});
	try {
		const endInner = leaving(inner);
		flushSync(() => set(value, 1));
		const endOuter = leaving(outer);
		flushSync(() => set(value, 2));
		assert.equal(get(readInner), 0);
		assert.equal(get(readOuter), 1);
		assert.equal(endInner(), true);
		assert.equal(get(readInner), 1);
		const endReplacement = leaving(inner);
		assert.equal(endOuter(), true);
		flushSync(() => set(value, 3));
		assert.equal(get(readInner), 2);
		assert.equal(endInner(), false);
		assert.equal(endReplacement(), true);
		assert.equal(get(readInner), 3);
	} finally {
		destroy(tree);
		flushSync();
	}
});

test('speculative fork removal starts its outgoing lifetime only at the real commit', async () => {
	const value = state(1);
	const visible = state(true);
	let child!: Effect;
	let selected!: Derived<number>;
	let end!: () => boolean;
	const tree = root(() => {
		child = branch(() => {
			selected = derived(() => get(value));
		});
		block(() => {
			if (!get(visible))
				atCommit({
					apply() {
						end = leaving(child);
					}
				});
		});
	});
	try {
		const staged = fork(() => {
			set(value, 2);
			set(visible, false);
		});
		assert.equal(typeof end, 'undefined');
		assert.equal(get(selected), 1);
		await staged.commit();
		assert.equal(get(selected), 1);
		assert.equal(get(value), 2);
		end?.();
		assert.equal(get(selected), 2);
	} finally {
		destroy(tree);
		flushSync();
	}
});

test('reentrant destruction reads current lifecycle values without ending the active historical read', () => {
	const value = state(1);
	const visible = state(true);
	const seen: number[] = [];
	let child!: Effect;
	let selected!: Derived<number>;
	const tree = root(() => {
		child = branch(() => {
			selected = derived(() => {
				untrack(() => destroy(child));
				return get(value);
			});
			destroyed(() => {
				seen.push(get(value));
			});
		});
		block(() => {
			if (!get(visible))
				atCommit({
					apply() {
						leaving(child);
					}
				});
		});
	});
	try {
		flushSync(() => {
			set(value, 2);
			set(visible, false);
		});
		assert.equal(get(selected), 1);
		assert.deepEqual(seen, [2]);
		assert.equal(get(value), 2);
	} finally {
		destroy(tree);
		flushSync();
	}
});

test('a removal flushed by an unrelated continuation uses the processing batch', () => {
	const value = state(1);
	const visible = state(true);
	let child!: Effect;
	let selected!: Derived<number>;
	const tree = root(() => {
		child = branch(() => {
			selected = derived(() => get(value));
		});
		block(() => {
			if (!get(visible))
				atCommit({
					apply() {
						leaving(child);
					}
				});
		});
	});
	const held = new Batch();
	let settle!: () => void;
	try {
		within(held, () => {
			settle = work();
		});
		process(held);
		set(value, 2);
		set(visible, false);
		within(held, () => flushSync());
		assert.equal(get(selected), 1);
	} finally {
		settle();
		destroy(tree);
		flushSync();
	}
});

test('ending an outgoing computation does not abort a current computation of the same derived', () => {
	const value = state(1);
	let child!: Effect;
	let outer!: Derived<{ value: number; signal: AbortSignal }>;
	let selected!: Derived<{ value: number; signal: AbortSignal }>;
	const tree = root(() => {
		outer = derived(() => ({ value: get(value), signal: getAbortSignal() }));
		child = branch(() => {
			selected = derived(() => get(outer));
		});
	});
	try {
		const end = leaving(child);
		flushSync(() => set(value, 2));
		const historical = get(selected);
		const current = get(outer);
		assert.equal(historical.value, 1);
		assert.equal(current.value, 2);
		end();
		assert.equal(historical.signal.aborted, true);
		assert.equal(current.signal.aborted, false);
		assert.notEqual(historical.signal, current.signal);
		destroy(tree);
		assert.equal(current.signal.aborted, true);
	} finally {
		destroy(tree);
		flushSync();
	}
});

test('outgoing enumeration retains deleted keys and key tracking ignores value-only changes', () => {
	const model = proxy<Record<string, number>>({ a: 1 });
	const seen: string[] = [];
	let child!: Effect;
	let names!: Derived<string>;
	const tree = root(() => {
		block(() => {
			seen.push(Reflect.ownKeys(model).join(','));
		});
		child = branch(() => {
			names = derived(() => Object.keys(model).join(','));
		});
	});
	try {
		flushSync(() => {
			model.a = 2;
		});
		assert.deepEqual(seen, ['a']);
		const end = leaving(child);
		flushSync(() => {
			delete model.a;
			model.b = 3;
		});
		assert.deepEqual(seen, ['a', 'b']);
		assert.equal(get(names), 'a');
		assert.equal(Object.keys(model).join(','), 'b');
		end();
		assert.equal(get(names), 'b');
	} finally {
		destroy(tree);
		flushSync();
	}
});
