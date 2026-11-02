import { flushSync, mount, unmount } from 'vigla';
import { render } from 'vigla/server';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client', 'async-server'],
	html: '',
	test({ assert, instance }) {
		const target = document.body.appendChild(document.createElement('div'));
		const warnings = [];
		const warn = console.warn;
		console.warn = (...args) => warnings.push(args.join(' '));
		try {
			const app = mount(instance.Child, { target });
			flushSync();
			unmount(app);
		} finally {
			console.warn = warn;
			target.remove();
		}
		assert.equal(warnings.length, 1, warnings.join('\n'));
		assert.match(warnings[0], /select_multiple_invalid_value/);
		assert.notMatch(warnings[0], /svelte/);
	},
	async test_ssr({ assert }) {
		const compiled = new URL('./_output/server/Child.svelte.js', import.meta.url).pathname;
		const { default: Child } = await import(/* @vite-ignore */ compiled);
		let message = '';
		try {
			render(Child, { props: { tag: 'bad tag' } });
		} catch (error) {
			message = error.message;
		}
		assert.match(message, /dynamic_element_invalid_tag/);
		assert.notMatch(message, /svelte/);
	}
});
