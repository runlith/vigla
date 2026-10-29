import { describe, assert, it } from 'vitest';
import { flushSync, untrack } from 'svelte';
import { SvelteSet } from 'svelte/reactivity';

function run_test(fn: () => () => void) {
	return () => {
		let execute: any;
		const destroy = $effect.root(() => {
			execute = fn();
		});
		execute();
		destroy();
	};
}

function unconverted() {
	throw new Error('not converted: its manifest status names the test asserting it');
}

function test(text: string, fn: () => () => void, timeout?: number) {
	it(`${text} (legacy mode)`, unconverted);
	it(`${text} (runes mode)`, run_test(fn), timeout);
}

test.skip = (text: string, fn: () => () => void) => {
	it.skip(`${text} (legacy mode)`, unconverted);
	it.skip(`${text} (runes mode)`, run_test(fn));
};

function covered(text: string) {
	it(`${text} (legacy mode)`, unconverted);
	it(`${text} (runes mode)`, unconverted);
}

describe('signals', () => {
	test('effect with state and derived in it', () => {
		const log: string[] = [];

		let count = $state(0);
		let double = $derived(count * 2);
		$effect(() => {
			log.push(`${count}:${double}`);
		});

		return () => {
			flushSync(() => (count = 1));
			flushSync(() => (count = 2));

			assert.deepEqual(log, ['0:0', '1:2', '2:4']);
		};
	});

	test('multiple effects with state and derived in it #1', () => {
		const log: string[] = [];

		let count = $state(0);
		let double = $derived(count * 2);

		$effect(() => {
			log.push(`A:${count}:${double}`);
		});
		$effect(() => {
			log.push(`B:${double}`);
		});

		return () => {
			flushSync(() => (count = 1));
			flushSync(() => (count = 2));

			assert.deepEqual(log, ['A:0:0', 'B:0', 'A:1:2', 'B:2', 'A:2:4', 'B:4']);
		};
	});

	test('multiple effects with state and derived in it #2', () => {
		const log: string[] = [];

		let count = $state(0);
		let double = $derived(count * 2);

		$effect(() => {
			log.push(`A:${double}`);
		});
		$effect(() => {
			log.push(`B:${count}:${double}`);
		});

		return () => {
			flushSync(() => (count = 1));
			flushSync(() => (count = 2));

			assert.deepEqual(log, ['A:0', 'B:0:0', 'A:2', 'B:1:2', 'A:4', 'B:2:4']);
		};
	});

	covered('unowned deriveds are not added as reactions but trigger effects');

	test('unowned deriveds track missing property checks on proxies', () => {
		const value = $state<Record<string, boolean>>({});

		return () => {
			const has_x = $derived('x' in value);
			const owns_y = $derived(Object.hasOwn(value, 'y'));

			assert.isFalse(has_x);
			assert.isFalse(owns_y);

			value.x = true;
			value.y = true;

			assert.isTrue(has_x);
			assert.isTrue(owns_y);

			delete value.x;
			delete value.y;

			assert.isFalse(has_x);
			assert.isFalse(owns_y);
		};
	});

	test('unowned deriveds track missing array indexes', () => {
		const value = $state<boolean[]>([]);

		return () => {
			const has_first = $derived(0 in value);

			assert.isFalse(has_first);

			value.push(true);
			assert.isTrue(has_first);

			value.length = 0;
			assert.isFalse(has_first);
		};
	});

	test('derived from state', () => {
		const log: number[] = [];

		let count = $state(0);
		let double = $derived(count * 2);

		$effect(() => {
			log.push(double);
		});

		return () => {
			flushSync(() => (count = 1));
			flushSync(() => (count = 2));

			assert.deepEqual(log, [0, 2, 4]);
		};
	});

	test('derived from derived', () => {
		const log: number[] = [];

		let count = $state(0);
		let double = $derived(count * 2);
		let quadruple = $derived(double * 2);

		$effect(() => {
			log.push(quadruple);
		});

		return () => {
			flushSync(() => (count = 1));
			flushSync(() => (count = 2));

			assert.deepEqual(log, [0, 4, 8]);
		};
	});

	test('state reset', () => {
		const log: number[] = [];

		let count = $state(0);
		let double = $derived(count * 2);

		$effect(() => {
			log.push(double);
		});

		return () => {
			flushSync();
			log.length = 0;

			count = 1;
			count = 0;

			flushSync();

			assert.deepEqual(log, []);

			count = 1;
			double;
			count = 0;

			flushSync();

			assert.deepEqual(log, [0]);
		};
	});

	test('https://perf.js.hyoo.ru/#!bench=9h2as6_u0mfnn', () => {
		let res: number[] = [];

		const numbers = Array.from({ length: 2 }, (_, i) => i);
		const fib = (n: number): number => (n < 2 ? 1 : fib(n - 1) + fib(n - 2));
		const hard = (n: number, l: string) => n + fib(16);

		let A = $state(0);
		let B = $state(0);
		const C = $derived((A % 2) + (B % 2));
		const D = $derived(numbers.map((i) => i + (A % 2) - (B % 2)));
		const E = $derived(hard(C + A + D[0]!, 'E'));
		const F = $derived(hard(D[0]! && B, 'F'));
		const G = $derived(C + (C || E % 2) + D[0]! + F);
		$effect(() => {
			res.push(hard(G, 'H'));
		});
		$effect(() => {
			res.push(G);
		});
		$effect(() => {
			res.push(hard(F, 'J'));
		});

		return () => {
			flushSync();

			let i = 2;
			while (--i) {
				res.length = 0;
				B = 1;
				A = 1 + i * 2;
				flushSync();

				A = 2 + i * 2;
				B = 2;
				flushSync();

				assert.equal(res.length, 4);
				assert.deepEqual(res, [3198, 1601, 3195, 1598]);
			}
		};
	});

	covered('https://perf.js.hyoo.ru/#!bench=9h2as6_u0mfnn #2');
	covered('effects correctly handle unowned derived values that do not change');
	covered('correctly cleanup unowned nested derived values');
	covered('effect with derived using unowned derived every time');

	let no_deps = $derived.by(() => {
		return [];
	});

	test('two effects with an unowned derived that has no dependencies', () => {
		const log: Array<Array<any>> = [];

		$effect.pre(() => {
			log.push(no_deps);
		});

		$effect.pre(() => {
			log.push(no_deps);
		});

		return () => {
			flushSync();
			assert.deepEqual(log, [[], []]);
		};
	});

	covered('two effects with an unowned derived that has some dependencies');

	test(
		'schedules rerun when writing to signal before reading it',
		() => {
			const error = console.error;
			console.error = () => {};

			let value = $state.raw({ count: 0 });
			$effect(() => {
				value = { count: 0 };
				value;
			});

			return () => {
				let errored = false;
				try {
					flushSync();
				} catch (e: any) {
					assert.include(e.message, 'effect_update_depth_exceeded');
					errored = true;
				} finally {
					assert.equal(errored, true);
					console.error = error;
				}
			};
		},
		60_000
	);

	test('schedules rerun when updating deeply nested value', () => {
		const error = console.error;
		console.error = () => {};

		const value = $state({ a: { b: { c: 0 } } });
		$effect(() => {
			value.a.b.c += 1;
		});

		return () => {
			let errored = false;
			try {
				flushSync();
			} catch (e: any) {
				assert.include(e.message, 'effect_update_depth_exceeded');
				errored = true;
			} finally {
				assert.equal(errored, true);
				console.error = error;
			}
		};
	});

	test.skip('schedules rerun when writing to signal before reading it', () => {
		const error = console.error;
		console.error = () => {};

		const value = $state<{ arr: unknown[] }>({ arr: [] });
		$effect(() => {
			value.arr = [];
			value.arr;
		});

		return () => {
			let errored = false;
			try {
				flushSync();
			} catch (e: any) {
				assert.include(e.message, 'effect_update_depth_exceeded');
				errored = true;
			} finally {
				assert.equal(errored, true);
				console.error = error;
			}
		};
	});

	test('schedules rerun when writing to signal before reading it from derived', () => {
		let log: any[] = [];

		let value = $state(1);
		const double = $derived(value * 2);

		$effect(() => {
			value = 10;
			log.push(double);
		});

		return () => {
			flushSync();
			assert.deepEqual(log, [20]);
		};
	});

	test('schedules rerun when writing to signal after reading it from derived', () => {
		let log: any[] = [];

		let value = $state(1);
		const double = $derived(value * 2);

		$effect(() => {
			log.push(double);
			value = 10;
		});

		return () => {
			flushSync();
			assert.deepEqual(log, [2, 20]);
		};
	});

	test('effect teardown is removed on re-run', () => {
		let count = $state(0);
		let first = true;
		let teardown = 0;

		$effect(() => {
			count;
			if (first) {
				first = false;
				return () => {
					teardown += 1;
				};
			}
		});

		return () => {
			flushSync(() => (count = 1));
			flushSync(() => (count = 2));
			assert.equal(teardown, 1);
		};
	});

	test('creating effects within a derived correctly handles ownership', () => {
		const log: Array<number | string> = [];
		let read: () => unknown;
		let inner = $state(0);
		let outer = $state(0);

		const destroy = $effect.root(() => {
			$effect.pre(() => {
				const a = $derived.by(() => {
					log.push('outer', outer);
					$effect(() => {
						log.push('inner', inner);
					});
					return outer;
				});
				read = () => a;
			});
		});

		return () => {
			flushSync(() => {
				read();
			});
			assert.deepEqual(log, ['outer', 0, 'inner', 0]);
			log.length = 0;
			flushSync(() => {
				inner = 1;
				read();
			});
			assert.deepEqual(log, ['inner', 1]);
			log.length = 0;
			flushSync(() => {
				outer = 1;
				read();
			});
			assert.deepEqual(log, ['outer', 1, 'inner', 1]);
			log.length = 0;
			flushSync(() => {
				inner = 2;
				read();
			});
			assert.deepEqual(log, ['inner', 2]);
			destroy();
		};
	});

	covered('owned deriveds correctly cleanup when no longer connected to graph');
	covered('mixed nested deriveds correctly cleanup when no longer connected to graph #1');
	covered('mixed nested deriveds correctly cleanup when no longer connected to graph #2');
	covered('mixed nested deriveds correctly cleanup when no longer connected to graph #3');

	test('deriveds update upon reconnection #1', () => {
		let a = $state(false);
		let b = $state(false);

		let c = $derived(a);
		let d = $derived(c);

		let last: Record<string, boolean | null> = {};

		$effect.pre(() => {
			last = {
				a: a,
				b: b,
				c: c,
				d: a || b ? d : null
			};
		});

		return () => {
			assert.deepEqual(last, { a: false, b: false, c: false, d: null });

			flushSync(() => (a = true));
			flushSync(() => (b = true));
			assert.deepEqual(last, { a: true, b: true, c: true, d: true });

			flushSync(() => (a = false));
			flushSync(() => (b = false));
			assert.deepEqual(last, { a: false, b: false, c: false, d: null });

			flushSync(() => (a = true));
			flushSync(() => (b = true));
			assert.deepEqual(last, { a: true, b: true, c: true, d: true });

			flushSync(() => (a = false));
			flushSync(() => (b = false));
			assert.deepEqual(last, { a: false, b: false, c: false, d: null });

			flushSync(() => (b = true));
			assert.deepEqual(last, { a: false, b: true, c: false, d: false });
		};
	});

	test('deriveds update upon reconnection #2', () => {
		let a = $state(false);
		let b = $state(false);
		let c = $state(false);

		let d = $derived(a || b);

		let branch = '';

		$effect.pre(() => {
			if (c && !d) {
				branch = 'if';
			} else {
				branch = 'else';
			}
		});

		return () => {
			assert.deepEqual(branch, 'else');

			flushSync(() => (c = true));
			assert.deepEqual(branch, 'if');

			flushSync(() => (a = true));
			assert.deepEqual(branch, 'else');

			a = false;
			b = false;
			c = false;
			flushSync();
			assert.deepEqual(branch, 'else');

			flushSync(() => (c = true));
			assert.deepEqual(branch, 'if');

			flushSync(() => (b = true));
			assert.deepEqual(branch, 'else');

			a = false;
			b = false;
			c = false;
			flushSync();
			assert.deepEqual(branch, 'else');

			flushSync(() => (c = true));
			assert.deepEqual(branch, 'if');
		};
	});

	test('deriveds update upon reconnection #3', () => {
		let a = $state(false);
		let b = $state(false);

		let c = $derived(a || b);
		let d = $derived(c);
		let e = $derived(d);

		return () => {
			const log: string[] = [];
			let destroy = $effect.root(() => {
				$effect.pre(() => {
					e;
					log.push('init');
				});
			});
			destroy();

			destroy = $effect.root(() => {
				$effect.pre(() => {
					e;
					log.push('update');
				});
			});

			assert.deepEqual(log, ['init', 'update']);

			a = true;
			flushSync();

			assert.deepEqual(log, ['init', 'update', 'update']);
		};
	});

	covered('unowned deriveds are not added as reactions');
	covered('unowned deriveds are correctly connected and disconnected from the graph');
	covered('unowned deriveds dependencies are correctly de-duped');

	test('unowned deriveds correctly update', () => {
		return () => {
			const arr1 = $state<{ a: number }[]>([]);
			const arr2 = $state([]);
			const combined = $derived([...arr1, ...arr2]);
			const derived_length = $derived(combined.length);

			assert.deepEqual(combined, []);
			assert.equal(derived_length, 0);

			arr1.push({ a: 1 });

			assert.deepEqual(combined, [{ a: 1 }]);
			assert.equal(derived_length, 1);
		};
	});

	test('deriveds do not depend on state they own', () => {
		return () => {
			let write: (value: number) => void;

			const d = $derived.by(() => {
				let s = $state(0);
				write = (value) => {
					s = value;
				};
				return s;
			});

			assert.equal(d, 0);

			write!(1);
			assert.equal(d, 0);
		};
	});

	test('effects do depend on state they own', () => {
		const log: number[] = [];
		let read: (() => number) | undefined;
		let write: (value: number) => void;

		$effect(() => {
			if (!read || read() < 2) {
				if (!read) {
					let count = $state(0);
					read = () => count;
					write = (value) => {
						count = value;
					};
				}
				log.push(read());
				write(read() + 1);
			}
		});

		return () => {
			flushSync();
			assert.deepEqual(log, [0, 1]);
		};
	});

	test('nested effects depend on state of upper effects', () => {
		const logs: number[] = [];
		let bump: () => void;

		$effect(() => {
			let raw = $state(0);
			const proxied = $state({ current: 0 });

			$effect(() => {
				logs.push(raw);
			});

			$effect(() => {
				logs.push(proxied.current);
			});

			bump = () => {
				raw = raw + 1;
				proxied.current += 1;
			};
		});

		return () => {
			flushSync();
			bump();
			flushSync();
			assert.deepEqual(logs, [0, 0, 1, 1]);
		};
	});

	test('nested effects depend on state of upper effects', () => {
		const logs: number[] = [];

		$effect.pre(() => {
			let raw = $state(0);
			const proxied = $state({ current: 0 });

			$effect.pre(() => {
				logs.push(raw);
			});

			$effect.pre(() => {
				logs.push(proxied.current);
			});

			flushSync();

			$effect.pre(() => {
				untrack(() => {
					raw = raw + 1;
					proxied.current += 1;
				});
			});
		});

		return () => {
			flushSync();
			assert.deepEqual(logs, [0, 0, 1, 1]);
		};
	});

	test('proxy version state does not trigger self-dependency guard', () => {
		return () => {
			const s = $state({ a: { b: 1 } });
			const d = $derived($state.snapshot(s));

			assert.deepEqual(d, s);
		};
	});

	test('set version state does not trigger self-dependency guard', () => {
		return () => {
			const set = new SvelteSet();
			const d = $derived(set.has('test'));

			set.add('test');
			assert.equal(d, true);
		};
	});

	covered('deriveds read inside the root/branches are cleaned up');
	covered('deriveds containing effects work correctly');

	test("deriveds set after they are DIRTY doesn't get updated on get", () => {
		return () => {
			let a = $state(0);
			let b = $derived(a);

			b = 1;
			assert.equal(b, 1);

			a = 2;
			assert.equal(b, 2);
			b = 3;

			assert.equal(b, 3);
		};
	});

	test("unowned deriveds set after they are DIRTY doesn't get updated on get", () => {
		return () => {
			let a = $state(0);
			let b = $derived(a);
			const c = $derived(b);

			b = 1;
			assert.equal(c, 1);

			a = 2;

			assert.equal(b, 2);
			assert.equal(c, 2);
		};
	});

	covered('deriveds containing effects work correctly when used with untrack');

	test('bigint states update correctly', () => {
		return () => {
			let count = $state(0n);

			assert.doesNotThrow(() => count++);
			assert.equal(count, 1n);
			assert.doesNotThrow(() => count--);
			assert.equal(count, 0n);

			assert.doesNotThrow(() => ++count);
			assert.equal(count, 1n);
			assert.doesNotThrow(() => --count);
			assert.equal(count, 0n);
		};
	});

	test('unowned deriveds correctly re-attach to their source', () => {
		const log: any[] = [];

		return () => {
			let a = $state(0);
			let b = $state(0);
			const c = $derived.by(() => {
				a;
				return b;
			});

			c;

			a = 1;

			const destroy = $effect.root(() => {
				$effect.pre(() => {
					log.push(c);
				});
			});

			assert.deepEqual(log, [0]);

			b = 1;

			flushSync();

			assert.deepEqual(log, [0, 1]);

			destroy();
		};
	});

	test('unowned deriveds correctly update', () => {
		const log: any[] = [];

		return () => {
			let a = $state(0);
			let b = $state(0);
			const c = $derived(a);
			const d = $derived(b);

			const destroy = $effect.root(() => {
				const e = $derived(c === 1 && d === 1);
				$effect.pre(() => {
					log.push(e);
				});
			});

			assert.deepEqual(log, [false]);

			a = 1;
			b = 1;

			flushSync();

			assert.deepEqual(log, [false, true]);

			b = 9;

			flushSync();

			assert.deepEqual(log, [false, true, false]);

			destroy();
		};
	});

	test('derived whose original parent effect has been destroyed no longer updates', () => {
		return () => {
			const warn = console.warn;
			const warnings: string[] = [];
			console.warn = (...args) => warnings.push(...args);

			let read: () => number;
			let write: (value: number) => void;
			const destroy = $effect.root(() => {
				$effect.pre(() => {
					let count = $state(0);
					const double = $derived(count * 2);
					read = () => double;
					write = (value) => {
						count = value;
					};
				});
			});

			flushSync();
			assert.equal(read!(), 0);
			flushSync();

			write!(1);
			flushSync();
			assert.equal(read!(), 2);

			destroy();

			assert.equal(read!(), 2);
			assert.equal(warnings.length, 0);

			write!(2);
			flushSync();
			assert.equal(read!(), 2);
			assert.ok(warnings.some((str) => str.includes('derived_inert')));

			console.warn = warn;
		};
	});

	test('derived when connected should add new dependency to its reaction even when read outside effect', () => {
		let count_a = $state(0);
		let count_b = $state(0);
		let which = $state(true);
		let double = $derived(which ? count_a * 2 : count_b * 2);

		$effect.pre(() => {
			double;
		});

		return () => {
			flushSync();
			assert.equal(double, 0);

			which = false;
			double;
			flushSync();
			assert.equal(double, 0);

			count_b = 1;
			flushSync();
			assert.equal(double, 2);
		};
	});

	test('$effect.root inside deriveds stay alive independently', () => {
		const log: any[] = [];
		let c = $state(0);
		const cleanup: any[] = [];
		const inner_states: Array<(value: number) => void> = [];

		const d = $derived.by(() => {
			const destroy = $effect.root(() => {
				let x = $state(0);
				inner_states.push((value) => {
					x = value;
				});

				$effect(() => {
					log.push('inner ' + x);
					return () => {
						log.push('inner destroyed');
					};
				});
			});

			cleanup.push(destroy);

			return c;
		});

		return () => {
			log.push(d);
			flushSync();

			assert.deepEqual(log, [0, 'inner 0']);
			log.length = 0;

			inner_states[0]!(1);
			flushSync();

			assert.deepEqual(log, ['inner destroyed', 'inner 1']);
			log.length = 0;

			c = 1;
			log.push(d);
			flushSync();

			assert.deepEqual(log, [1, 'inner 0']);
			log.length = 0;

			cleanup.forEach((fn) => fn());
			flushSync();

			assert.deepEqual(log, ['inner destroyed', 'inner destroyed']);
		};
	});

	covered('derived read in an untracked context should not leak in deps reactions');
	covered('untracked derived reads inside effects do not reconnect disconnected dependencies');
	covered('reconnecting deriveds does not duplicate subscriptions');
	covered('a reaction that throws after first-reading a fresh derived does not leak it');
	covered('a derived that throws on its first run re-runs when its dependencies change');

	it('does not treat values created for inactive reactions as current', unconverted);
});
