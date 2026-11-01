import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	async test({ assert, target }) {
		const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
		const grid = target.querySelector('.grid');
		const cells = [...grid.children].filter((node) => ['3', '6', '9'].includes(node.textContent.trim()));
		assert.equal(cells.length, 3);
		const before = cells.map((cell) => cell.getBoundingClientRect());

		target.querySelector('button').click();
		let animations = [];
		for (let i = 0; i < 120; i++) {
			await frame();
			animations = cells.map((cell) => cell.getAnimations()[0]);
			if (animations.every(Boolean)) break;
		}
		assert.ok(animations.every(Boolean));
		for (const animation of animations) {
			animation.pause();
			animation.currentTime = 0;
		}
		await frame();
		await frame();
		const start = cells.map((cell) => cell.getBoundingClientRect());
		for (const [i, rect] of start.entries()) {
			assert.ok(Math.abs(rect.x - before[i].x) < 1);
			assert.ok(Math.abs(rect.y - before[i].y) < 1);
			assert.ok(Math.abs(rect.width - before[i].width) < 1);
		}

		for (const animation of animations) {
			animation.currentTime = animation.effect.getTiming().duration / 2;
		}
		await frame();
		await frame();
		const middle = cells.map((cell) => cell.getBoundingClientRect());
		for (const animation of animations) animation.finish();
		await frame();
		await frame();
		const end = cells.map((cell) => cell.getBoundingClientRect());
		const bounds = grid.getBoundingClientRect();
		const rightColumn = bounds.left + (bounds.width + 16) / 2;
		for (const [i, rect] of end.entries()) {
			assert.ok(Math.abs(rect.x - rightColumn) < 1);
			assert.ok(Math.abs(rect.y - before[i].y) < 1);
			assert.ok(Math.abs(rect.width - (bounds.width - 16) / 2) < 1);
			assert.ok(middle[i].x > rect.x && middle[i].x < start[i].x);
			assert.ok(middle[i].width > start[i].width && middle[i].width < rect.width);
			assert.ok(Math.abs(middle[i].y - before[i].y) < 1);
		}
	}
});
