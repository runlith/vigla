import { hydrate, mount, settled, unmount } from 'vigla';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	async test({ instance, target, assert }) {
		(window.__vigla ??= {}).h = new Map([['key', Promise.resolve('server')]]);
		const containers = Array.from({ length: 3 }, () => target.appendChild(document.createElement('main')));
		const body = '<!--[--><!--[--><p>server</p><!--]--><!--]-->';
		containers[0].innerHTML = body;
		containers[1].innerHTML = body;
		const instances = [];
		try {
			instances.push(hydrate(instance.Child, { target: containers[0], recover: false }));
			instances.push(hydrate(instance.Child, { target: containers[1], recover: false }));
			await settled();
			assert.equal(containers[0].textContent, 'server');
			assert.equal(containers[1].textContent, 'server');
			instances.push(mount(instance.Child, { target: containers[2] }));
			await settled();
			assert.equal(containers[2].textContent, 'client');
		} finally {
			for (const instance of instances) await unmount(instance);
			for (const container of containers) container.remove();
		}
	}
});
