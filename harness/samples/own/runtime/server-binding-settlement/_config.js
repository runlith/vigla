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
		const first = render(Main, { props: { gate: gateA, label: 'a' } });
		const second = render(Main, { props: { gate: gateB, label: 'b', template: true } });
		releaseB('B');
		const resultB = await second;
		releaseA('A');
		const resultA = await first;
		for (const [result, value] of [[resultA, 'A:a:child'], [resultB, 'B:b:child']]) {
			assert.htmlEqual(result.body, `<p>${value}</p><section>${value}<span>${value}</span>${value}</section><p>${value}</p>`);
			assert.htmlEqual(result.head, `<meta name="bound" content="${value}"><title>${value}</title>`);
		}
	}
});
