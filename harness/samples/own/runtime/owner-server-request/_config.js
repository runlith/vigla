import { root } from 'vigla/internal/index-server';
import { render } from 'vigla/server';
import { test } from '@vigla/harness/helpers';

const transformError = () => 'failed';

export default test({
	mode: ['async-server'],
	props: { log: [], gate: Promise.resolve(true) },
	transformError,
	html: '<p>before</p><p>failed</p><p>late</p>',
	async test_ssr({ assert }) {
		const compiled = new URL('./_output/server/main.svelte.js', import.meta.url).pathname;
		const { default: Main } = await import(/* @vite-ignore */ compiled);
		const request = root();
		const log = [];
		let open;
		const gate = new Promise((resolve) => (open = resolve));
		const rendering = request.run(() =>
			render(Main, { props: { log, gate }, transformError })
		);
		assert.deepEqual(log, []);
		request.dispose();
		assert.deepEqual(log, ['discarded', 'before', 'main']);
		open(true);
		const { body } = await rendering;
		assert.deepEqual(log, ['discarded', 'before', 'main', 'late']);
		assert.ok(body.includes('<p>late</p>'), body);
	}
});
