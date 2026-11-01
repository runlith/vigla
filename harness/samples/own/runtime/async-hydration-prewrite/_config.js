import { settled } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['hydrate'],
	props: { data: undefined },
	server_props: { data: { root: 'root', child: 'child' } },
	async test({ assert, component, target, logs, hydrate }) {
		assert.isNotNull(target.querySelector('span'));
		component.data = { root: 'root', child: 'child' };
		hydrate();
		await new Promise(resolve => setTimeout(resolve, 0));
		await settled();
		assert.isNotNull(target.querySelector('p'));
		assert.isNull(target.querySelector('span'));
		assert.deepEqual(logs, ['root/child']);
	}
});
