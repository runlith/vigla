import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	async test({ assert, target }) {
		const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
		const advance = async () => { await frame(); await frame(); await frame(); };
		const rect = (node) => {
			const { x, y, width, height } = node.getBoundingClientRect();
			return { x, y, width, height };
		};
		const gap = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y),
			Math.abs(a.width - b.width), Math.abs(a.height - b.height));
		const tiles = (name) => [...target.querySelectorAll(`[data-key="${name}"]`)];
		flushSync(() => target.querySelector('[data-seed]').click());
		await advance();
		const slide = tiles('channel')[0].getAnimations();
		assert.ok(slide.length > 0);
		for (const animation of slide) { animation.pause(); animation.currentTime = 1000; }
		await frame(); await frame();
		const names = ['late', 'own', 'channel', 'authored'];
		const senders = Object.fromEntries(names.map((name) => [name, tiles(name)[0]]));
		const before = Object.fromEntries(names.map((name) => [name, rect(senders[name])]));
		const authored = senders.authored.getAnimations();
		assert.equal(authored.length, 1);
		const existing = target.ownerDocument.getAnimations();
		flushSync(() => target.querySelector('[data-move]').click());
		await advance();
		assert.equal(authored[0].playState, 'running');
		assert.ok(senders.authored.getAnimations().includes(authored[0]));
		const fresh = target.ownerDocument.getAnimations().filter((animation) => !existing.includes(animation));
		assert.equal(fresh.length, 8);
		for (const animation of fresh) { animation.pause(); animation.currentTime = 0; }
		await frame(); await frame();
		for (const name of names) {
			const receiver = tiles(name).find((node) => node !== senders[name]);
			assert.ok(gap(rect(receiver), before[name]) < 0.5, `${name} receiver ${JSON.stringify(rect(receiver))} versus ${JSON.stringify(before[name])}`);
		}
		for (const name of ['own', 'channel', 'authored']) {
			assert.ok(gap(rect(senders[name]), before[name]) < 0.5, `${name} sender ${JSON.stringify(rect(senders[name]))}`);
		}
		for (const animation of slide) animation.currentTime = 1500;
		await frame(); await frame();
		assert.ok(gap(rect(senders.channel), before.channel) < 0.5, `channel sender drifted to ${JSON.stringify(rect(senders.channel))}`);
		for (const animation of target.ownerDocument.getAnimations()) if (animation !== authored[0]) animation.finish();
		await advance(); await advance();
		for (const name of names) assert.equal(tiles(name).length, 1);
		authored[0].finish();
	}
});
