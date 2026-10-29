// @vitest-environment jsdom
import '@vigla/harness/helpers'; // for the matchMedia polyfill
import { describe, it, assert } from 'vitest';
import { Tween } from 'svelte/motion';
import { raf } from '@vigla/harness/helpers';

function dropped() {
	throw new Error('dropped: its manifest status gives the reason');
}

describe('motion', () => {
	describe('spring', () => {
		it('handles initially undefined values', dropped);
	});

	describe('tweened', () => {
		it('handles initially undefined values', dropped);

		it('sets immediately when duration is 0', dropped);

		it('updates correctly when initialized with a `null`-ish value', dropped);

		it('updates non-numeric values immediately', dropped);
	});

	describe('Tween', () => {
		it('sets immediately when duration is 0', () => {
			const size = new Tween(0);

			size.set(100, { duration: 0 });
			assert.equal(size.current, 100);
		});

		it('updates non-numeric values immediately', () => {
			raf.reset();
			const boolean = new Tween(false);

			boolean.set(true, { duration: 100 });

			raf.tick(1);
			assert.equal(boolean.current, true);
		});
	});

	it('updates correctly when initialized with a `null`-ish value', () => {
		const size = new Tween(undefined as unknown as number, { duration: 0 });

		size.set(10);
		assert.equal(size.current, 10);
	});
});
