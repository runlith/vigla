import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	async test({ assert, target }) {
		const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
		const advance = async () => { await frame(); await frame(); await frame(); };
		const nodes = () => [...target.querySelectorAll('[data-key]')];
		const declarations = (node) => Object.fromEntries([...node.style].sort().map((name) =>
			[name, [node.style.getPropertyValue(name), node.style.getPropertyPriority(name)]]));
		const rect = (node) => {
			const { x, y, width, height } = node.getBoundingClientRect();
			return { x, y, width, height };
		};
		const gap = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y),
			Math.abs(a.width - b.width), Math.abs(a.height - b.height));
		const old = nodes();
		const before = old.map((node) => ({ node, kind: node.closest('section').dataset.kind,
			key: node.dataset.key, side: node.parentElement.dataset.side,
			style: declarations(node), rect: rect(node) }));
		const authored = old.map((node) => {
			const animation = node.animate([{ filter: 'blur(0px)' }, { filter: 'blur(1px)' }],
				{ duration: 10000, fill: 'both' });
			animation.pause();
			animation.currentTime = 0;
			return animation;
		});
		const owned = () => nodes().flatMap((node) => node.getAnimations()).filter((animation) => !authored.includes(animation));
		flushSync(() => target.querySelector('[data-swap]').click());
		await advance();
		const first = owned();
		assert.equal(first.length, 16);
		for (const animation of first) { animation.pause(); animation.currentTime = 0; }
		await frame(); await frame();
		for (const node of nodes()) {
			const source = before.find((item) => item.kind === node.closest('section').dataset.kind && item.key === node.dataset.key);
			assert.ok(gap(rect(node), source.rect) < 0.02, `source ${source.kind}/${source.key}: ${JSON.stringify(rect(node))} versus ${JSON.stringify(source.rect)}`);
		}
		for (const animation of first) animation.currentTime = 999.999;
		await frame(); await frame();
		assert.equal(nodes().length, 16);
		for (const node of nodes()) {
			const destination = before.find((item) => item.kind === node.closest('section').dataset.kind && item.key !== node.dataset.key);
			assert.ok(gap(rect(node), destination.rect) < 0.02, `target ${destination.kind}/${node.dataset.key}: ${JSON.stringify(rect(node))} versus ${JSON.stringify(destination.rect)}`);
		}
		for (const animation of first) animation.currentTime = 400;
		await frame(); await frame();
		flushSync(() => target.querySelector('[data-swap]').click());
		await advance();
		for (const item of before) {
			assert.ok(item.node.isConnected);
			assert.deepEqual(declarations(item.node), item.style);
		}
		for (const animation of owned()) animation.finish();
		await advance();
		assert.equal(nodes().length, 8);
		for (const item of before) {
			assert.ok(item.node.isConnected);
			assert.deepEqual(declarations(item.node), item.style);
			assert.ok(gap(rect(item.node), item.rect) < 0.02, `restored ${item.kind}/${item.key}`);
		}
		flushSync(() => target.querySelector('[data-swap]').click());
		await advance();
		flushSync(() => target.querySelector('[data-remove]').click());
		assert.equal(nodes().length, 0);
		for (const item of before) {
			assert.equal(item.node.isConnected, false);
			assert.deepEqual(declarations(item.node), item.style);
		}
		for (const animation of authored) {
			assert.equal(animation.playState, 'paused');
			assert.equal(animation.currentTime, 0);
			animation.cancel();
		}
	}
});
