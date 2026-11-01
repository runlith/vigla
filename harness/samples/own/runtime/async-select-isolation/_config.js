import { render } from 'svelte/server';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['async-server'],
	async test_ssr({ assert }) {
		const path = new URL('./_output/server/main.svelte.js', import.meta.url).pathname;
		const { default: Main } = await import(/* @vite-ignore */ path);
		let releaseA;
		let releaseB;
		const gateA = new Promise((resolve) => { releaseA = resolve; });
		const gateB = new Promise((resolve) => { releaseB = resolve; });
		const first = render(Main, { props: { choice: 'a', gate: gateA } });
		const second = render(Main, { props: { choice: 'b', gate: gateB } });
		releaseB('b');
		const resultB = await second;
		releaseA('a');
		const resultA = await first;
		assert.htmlEqual(resultA.body, '<select><option value="a" selected>a</option><option value="z">z</option></select>');
		assert.htmlEqual(resultB.body, '<select><option value="b" selected>b</option><option value="z">z</option></select>');
		assert.include(resultA.head, 'content="a"');
		assert.include(resultB.head, 'content="b"');
		let reject;
		const rejected = new Promise((_, fail) => { reject = fail; });
		const failing = render(Main, { props: { gate: rejected }, transformError: (error) => error.message });
		reject(new Error('failed'));
		const result = await failing;
		assert.htmlEqual(result.body, '<p>failed</p>');
		assert.equal(result.head, '');
	}
});
