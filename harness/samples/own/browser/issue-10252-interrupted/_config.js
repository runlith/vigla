import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	async test({ assert, target }) {
		const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
		const advance = async () => { await frame(); await frame(); await frame(); };
		const nodes = () => [...target.querySelectorAll('[data-id]')];
		const animations = () => nodes().flatMap((node) => node.getAnimations());
		const visible = () => nodes().filter((node) => +getComputedStyle(node).opacity > 0.05).map((node) => {
			const { x, y, width, height } = node.getBoundingClientRect();
			return { id: node.dataset.id, x, y, width, height };
		});
		const gap = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y),
			Math.abs(a.width - b.width), Math.abs(a.height - b.height));
		const button = target.querySelector('button');
		flushSync(() => button.click());
		await advance();
		const first = animations();
		for (const animation of first) { animation.pause(); animation.currentTime = 400; }
		await frame(); await frame();
		const before = visible();
		flushSync(() => button.click());
		await advance();
		const fresh = animations().filter((animation) => !first.includes(animation));
		assert.ok(fresh.length > 0);
		for (const animation of fresh) { animation.pause(); animation.currentTime = 0; }
		await frame(); await frame();
		const start = visible();
		for (const state of before) {
			assert.ok(start.some((next) => next.id === state.id && gap(next, state) < 0.5),
				`interrupted ${JSON.stringify(state)}; restarted ${JSON.stringify(start)}`);
		}
		for (const animation of animations()) animation.currentTime = Number(animation.effect.getTiming().duration) - 0.001;
		await frame(); await frame();
		const end = visible();
		for (const animation of animations()) animation.finish();
		await advance(); await advance();
		const final = visible();
		assert.equal(nodes().length, 6);
		assert.deepEqual(nodes().map((node) => node.dataset.id).sort(), ['1', '2', '3', '4', '5', '6']);
		assert.deepEqual([...target.querySelector('[data-team="a"]').children].map((node) => node.dataset.id), ['1', '2', '5']);
		for (const node of nodes()) {
			assert.equal(node.style.length, 0, `declarations left on ${node.dataset.id}: ${node.getAttribute('style')}`);
			assert.equal(node.getAnimations().length, 0);
		}
		for (const state of end) {
			const slot = final.find((item) => item.id === state.id);
			assert.ok(slot !== undefined && gap(state, slot) < 0.5, `ending ${JSON.stringify(state)}; final ${JSON.stringify(final)}`);
		}
	}
});
