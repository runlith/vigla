import assert from 'node:assert/strict';
import { test } from 'node:test';
import { work } from './src/runtime/reactivity/async.ts';
import {
	alias,
	atCommit,
	atMerge,
	Batch,
	current,
	flushSync,
	process,
	within
} from './src/runtime/reactivity/batch.ts';
import { block, destroy, root } from './src/runtime/reactivity/effects.ts';
import { fork } from './src/runtime/reactivity/fork.ts';
import { set, state } from './src/runtime/reactivity/sources.ts';
import { get } from './src/runtime/reactivity/tracking.ts';

test('a commit captures every participant before applying and prepares reentrant changes in the next wave', () => {
	const selected = state(false);
	const captured: number[] = [];
	let committed = 0;
	const tree = root(() => {
		block(() => {
			if (!get(selected)) return;
			atCommit({
				prepare() {
					captured.push(committed);
				},
				apply() {
					committed = 1;
					atCommit({
						prepare() {
							captured.push(committed);
						},
						apply() {
							committed = 3;
						}
					});
				}
			});
			atCommit({
				prepare() {
					captured.push(committed);
				},
				apply() {
					committed = 2;
				}
			});
		});
	});
	try {
		flushSync(() => set(selected, true));
		assert.deepEqual(captured, [0, 0, 2]);
		assert.equal(committed, 3);
	} finally {
		destroy(tree);
		flushSync();
	}
});

test('held and fork choices prepare only on their real commit', async () => {
	const selected = state(0);
	const captured: number[] = [];
	let committed = 0;
	const tree = root(() => {
		block(() => {
			const choice = get(selected);
			if (choice === 0) return;
			atCommit({
				prepare() {
					captured.push(committed);
				},
				apply() {
					committed = choice;
				}
			});
		});
	});
	const held = new Batch();
	let settle!: () => void;
	try {
		within(held, () => {
			set(selected, 1);
			settle = work();
		});
		process(held);
		assert.deepEqual(captured, []);
		assert.equal(committed, 0);
		settle();
		flushSync();
		assert.deepEqual(captured, [0]);
		assert.equal(committed, 1);
		const staged = fork(() => set(selected, 2));
		assert.deepEqual(captured, [0]);
		assert.equal(committed, 1);
		await staged.commit();
		assert.deepEqual(captured, [0, 1]);
		assert.equal(committed, 2);
	} finally {
		settle?.();
		destroy(tree);
		flushSync();
	}
});

for (const phase of ['prepare', 'apply'] as const) {
	test(`a failed ${phase} hands unapplied changes on before reentrant registrations without replaying the failure`, () => {
		const selected = state(false);
		const failure = new Error(phase);
		let committed = 0;
		let failed = 0;
		const tree = root(() => {
			block(() => {
				if (!get(selected)) return;
				atCommit({
					apply() {
						committed = committed * 10 + 1;
					}
				});
				const fail = () => {
					failed++;
					atCommit({
						apply() {
							committed = committed * 10 + 4;
						}
					});
					throw failure;
				};
				atCommit({
					prepare: phase === 'prepare' ? fail : undefined,
					apply:
						phase === 'apply'
							? fail
							: () => {
									committed = committed * 10 + 2;
								}
				});
				atCommit({
					apply() {
						committed = committed * 10 + 3;
					}
				});
			});
		});
		try {
			assert.throws(
				() => flushSync(() => set(selected, true)),
				(error) => error === failure
			);
			assert.equal(committed, phase === 'prepare' ? 0 : 1);
			flushSync();
			assert.equal(committed, 134);
			assert.equal(failed, 1);
		} finally {
			destroy(tree);
			flushSync();
		}
	});
}

test('a choice staged during commit transfers to its rescue alias before its queued application', () => {
	const selected = state(false);
	const choices = new Map<Batch, number>();
	const failure = new Error('handoff');
	let shown: number | undefined = 0;
	const tree = root(() => {
		block(() => {
			if (!get(selected)) return;
			atCommit({
				apply() {
					const batch = current();
					choices.set(batch, 2);
					atCommit({
						apply() {
							shown = choices.get(alias(batch));
						}
					});
					atMerge((from, into) => {
						const choice = choices.get(from);
						choices.delete(from);
						if (choice !== undefined) choices.set(into, choice);
					});
					throw failure;
				}
			});
		});
	});
	try {
		assert.throws(
			() => flushSync(() => set(selected, true)),
			(error) => error === failure
		);
		assert.equal(shown, 0);
		flushSync();
		assert.equal(shown, 2);
	} finally {
		destroy(tree);
		flushSync();
	}
});
