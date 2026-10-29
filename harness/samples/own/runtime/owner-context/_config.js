import { createContext, getContext, root, setContext } from 'vigla';
import { getContext as componentContext } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	html: '<p>app</p>',
	async test({ assert, target }) {
		const app = root();
		const [session, setSession] = createContext();
		app.run(() => {
			setContext('scope', 'app');
			setSession('s1');
		});

		let seen = null;
		const service = root(() => {
			seen = [getContext('scope'), session()];
		}, app);
		assert.deepEqual(seen, ['app', 's1']);

		await Promise.resolve();
		assert.deepEqual(
			service.run(() => [getContext('scope'), session()]),
			['app', 's1']
		);

		const tab = root(undefined, app);
		tab.run(() => setContext('scope', 'tab'));
		assert.equal(tab.run(() => getContext('scope')), 'tab');
		assert.equal(app.run(() => getContext('scope')), 'app');

		assert.throws(() => root(() => session()), /missing_context/);
		assert.throws(() => componentContext('scope'), /lifecycle_outside_component/);
		assert.htmlEqual(target.innerHTML, '<p>app</p>');
		app.dispose();
	}
});
