import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['hydrate'],
	compileOptions: { dev: true },
	server_props: {
		src: '/a.png',
		srcset: '/a.png 1x, /b.png 2x',
		ignored: 'server.png'
	},
	get props() {
		const a = new URL('/a.png', document.baseURI).href;
		const b = new URL('/b.png', document.baseURI).href;
		return { src: a, srcset: `${a} 1x, ${b} 2x`, ignored: 'client.png' };
	},
	test({ assert, target, warnings }) {
		const [same, ignored] = target.querySelectorAll('img');
		assert.equal(same.getAttribute('src'), '/a.png');
		assert.equal(same.getAttribute('srcset'), '/a.png 1x, /b.png 2x');
		assert.equal(ignored.getAttribute('src'), 'server.png');
		assert.deepEqual(warnings, []);
	}
});
