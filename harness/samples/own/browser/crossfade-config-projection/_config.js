import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	async test({ assert, target }) {
		const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
		const rect = (node) => {
			const { x, y, width, height } = node.getBoundingClientRect();
			return { x, y, width, height };
		};
		const gap = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y),
			Math.abs(a.width - b.width), Math.abs(a.height - b.height));
		const source = target.querySelector('[data-key]');
		const unmatched = target.querySelector('[data-unmatched]');
		const from = rect(source);
		const to = rect(target.querySelector('[data-side="right"]'));
		const distance = Math.hypot(from.x - to.x, from.y - to.y);
		flushSync(() => target.querySelector('button').click());
		await frame(); await frame(); await frame();
		const receiver = [...target.querySelectorAll('[data-key]')].find((node) => node !== source);
		for (const node of [source, receiver]) {
			assert.equal(+node.dataset.calls, 1);
			assert.ok(Math.abs(+node.dataset.distance - distance) < 0.01);
			assert.ok(Math.abs(+node.dataset.duration - (100 + distance)) < 0.01);
			assert.equal(+node.dataset.delay, 7);
			assert.equal(+node.dataset.easing, 1);
		}
		assert.equal(+unmatched.dataset.fallbackCalls, 1);
		assert.equal(+unmatched.dataset.duration, 200);
		assert.equal(+unmatched.dataset.delay, 7);
		assert.equal(+unmatched.dataset.easing, 1);
		assert.ok(Number.isFinite(+unmatched.dataset.fallback));
		assert.equal(+unmatched.dataset.fallback, +unmatched.dataset.sample);
		const trace = JSON.parse(target.querySelector('[data-configs]').textContent);
		let depth = 0;
		for (const event of trace) {
			if (event.phase === 'before') { assert.equal(depth, 0); depth += 1; }
			else if (event.phase === 'after') { assert.equal(depth, 1); depth -= 1; }
			else assert.equal(depth, 1);
		}
		assert.equal(depth, 0);
		assert.deepEqual(trace.filter((event) => event.phase === 'before').map(({ key, role }) => [key, role]),
			[[1, 'out'], ['unmatched', 'out'], [1, 'in']]);
		const motions = [source, receiver, unmatched].flatMap((node) => node.getAnimations().map((animation) => ({ node, animation })));
		assert.equal(motions.length, 3);
		for (const { node, animation } of motions) {
			const duration = animation.effect.getTiming().duration;
			assert.ok(Math.abs(duration - (node === unmatched ? 400 : 2 * (100 + distance))) < 0.01);
			animation.pause();
			animation.currentTime = 0;
		}
		await frame(); await frame();
		assert.ok(gap(rect(source), from) < 0.01);
		assert.ok(gap(rect(receiver), from) < 0.01);
		for (const { animation } of motions) animation.currentTime = Number(animation.effect.getTiming().duration) / 2;
		await frame(); await frame();
		const middle = { x: from.x + (to.x - from.x) * 0.25, y: from.y + (to.y - from.y) * 0.25, width: from.width, height: from.height };
		assert.ok(gap(rect(source), middle) < 0.1);
		assert.ok(gap(rect(receiver), middle) < 0.1);
		assert.ok(Math.abs(+getComputedStyle(source).opacity - 0.75) < 0.002);
		assert.ok(Math.abs(+getComputedStyle(receiver).opacity - 0.25) < 0.002);
		for (const { animation } of motions) animation.currentTime = Number(animation.effect.getTiming().duration) - 0.001;
		await frame(); await frame();
		assert.ok(source.isConnected);
		assert.ok(gap(rect(source), to) < 0.01);
		assert.ok(gap(rect(receiver), to) < 0.01);
		for (const { animation } of motions) animation.finish();
		await frame(); await frame();
		assert.equal(target.querySelector('[data-key]'), receiver);
		assert.equal(target.querySelectorAll('[data-key]').length, 1);
		assert.equal(target.querySelector('[data-unmatched]'), null);
		assert.ok(gap(rect(receiver), to) < 0.01);
	}
});
