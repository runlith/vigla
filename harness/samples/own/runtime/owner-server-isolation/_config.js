import { getContext, getOwner, root, setContext } from 'vigla/internal/index-server';
import { render } from 'vigla/server';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['async-server'],
	props: { name: 'page', gate: Promise.resolve('x') },
	html: '<p>page:xpagexpagexpagexxx</p>',
	async test_ssr({ assert }) {
		const compiled = new URL('./_output/server/main.svelte.js', import.meta.url).pathname;
		const { default: Main } = await import(/* @vite-ignore */ compiled);
		const gate = Promise.withResolvers();
		const requests = ['first', 'second'].map((name) => {
			const request = root();
			request.run(() => setContext('request', name));
			return request;
		});
		const pages = requests.map((request, index) =>
			request.run(() => render(Main, { props: { name: String(index), gate: gate.promise } }))
		);
		const foreign = [];
		const observing = requests[0].run(async () => {
			await gate.promise;
			for (let tick = 0; tick < 40; tick++) {
				const owner = getOwner();
				const seen = owner === null ? undefined : getContext('request');
				if (seen !== undefined && seen !== 'first') foreign.push(`context ${seen}`);
				if (owner !== null && owner !== requests[0])
					foreign.push(`render of ${owner.parent === requests[0] ? 'first' : 'second'}`);
				await null;
			}
		});
		gate.resolve('x');
		const [first, second] = await Promise.all(pages);
		await observing;
		for (const request of requests) request.dispose();
		assert.equal([...new Set(foreign)].join(', '), '');
		assert.htmlEqual(first.body, '<p>0:x0x0x0xxx</p>');
		assert.htmlEqual(second.body, '<p>1:x1x1x1xxx</p>');
	}
});
