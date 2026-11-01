import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	async test({ assert, target }) {
		const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
		const snapshot = () => [...target.querySelectorAll('[data-id]')]
			.filter((node) => +getComputedStyle(node).opacity > 0.05)
			.map((node) => ({ id: node.dataset.id, rect: node.getBoundingClientRect() }));
		const before = snapshot();
		assert.equal(before.length, 6);
		target.querySelector('button').click();
		await frame();
		await frame();
		await frame();
		const animations = [...target.querySelectorAll('[data-id]')].flatMap((node) => node.getAnimations());
		assert.ok(animations.length > 0);
		for (const animation of animations) {
			animation.pause();
			animation.currentTime = 0;
		}
		await frame();
		await frame();
		const after = snapshot();
		for (const item of before) {
			const distances = after.filter((next) => next.id === item.id)
				.map((next) => Math.hypot(next.rect.x - item.rect.x, next.rect.y - item.rect.y));
			assert.ok(distances.some((distance) => distance < 2), `item ${item.id} moved: ${distances.join(', ')}`);
		}
	}
});
