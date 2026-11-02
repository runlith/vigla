import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	async test({ assert, target }) {
		const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
		const nodes = () => [...target.querySelectorAll('[data-key]')];
		const old = nodes();
		const states = () => nodes().map((node) => {
			const { x, y, width, height } = node.getBoundingClientRect();
			return { mode: node.closest('section').dataset.mode, key: node.dataset.key,
				sender: old.includes(node), side: node.parentElement.dataset.side,
				x, y, width, height, opacity: +getComputedStyle(node).opacity };
		});
		const same = (a, b) => a.mode === b.mode && a.key === b.key;
		const gap = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y),
			Math.abs(a.width - b.width), Math.abs(a.height - b.height));
		const before = states();
		flushSync(() => target.querySelector('button').click());
		await frame(); await frame(); await frame();
		const animations = nodes().flatMap((node) => node.getAnimations());
		assert.equal(animations.length, 8);
		for (const animation of animations) {
			assert.equal(animation.effect.getTiming().duration, 1000);
			animation.pause();
			animation.currentTime = 0;
		}
		await frame(); await frame();
		const start = states();
		for (const animation of animations) animation.currentTime = 999.999;
		await frame(); await frame();
		const end = states();
		for (const animation of animations) animation.finish();
		await frame(); await frame();
		const final = states();
		assert.equal(start.length, 8);
		assert.equal(end.length, 8);
		assert.equal(final.length, 4);
		for (const state of start) {
			assert.ok(gap(state, before.find((item) => same(item, state))) < 0.01,
				`source ${JSON.stringify(state)}; before ${JSON.stringify(before)}`);
			assert.ok(Math.abs(state.opacity - (state.sender ? 1 : 0)) < 0.01);
		}
		for (const state of end) {
			assert.ok(gap(state, final.find((item) => same(item, state))) < 0.01,
				`target ${JSON.stringify(state)}; final ${JSON.stringify(final)}`);
			assert.ok(Math.abs(state.opacity - (state.sender ? 0 : 1)) < 0.01);
		}
		for (const state of final) {
			assert.equal(state.sender, false);
			assert.equal(state.key, state.side === 'left' ? '2' : '1');
			const slot = target.querySelector(`[data-mode="${state.mode}"] [data-side="${state.side}"]`).getBoundingClientRect();
			assert.ok(gap(state, slot) < 0.01, `final slot ${JSON.stringify(state)}`);
		}
	}
});
