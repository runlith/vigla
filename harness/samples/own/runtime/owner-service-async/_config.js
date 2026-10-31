import { cell, flushSync, root, settled } from 'vigla';
import { test } from '@vigla/harness/helpers';

const app = root();
const gate = Promise.withResolvers();
const value = cell('idle');

export default test({
	mode: ['client'],
	props: { app, gate, value },
	async test({ assert, target, logs }) {
		try {
			assert.deepEqual(logs, ['idle']);
			flushSync(() => target.querySelector('button').click());
			assert.equal(target.querySelector('p'), null);
			let done = false;
			const waiting = settled().then(() => (done = true));
			flushSync();
			await Promise.resolve();
			assert.equal(done, false);
			gate.resolve('ready');
			await waiting;
			assert.equal(target.querySelector('output').textContent, 'ready');
			assert.deepEqual(logs, ['idle', 'ready']);
			assert.equal(await app.start(() => 42), 42);
			const failure = new Error('service failed');
			await app.start(() => { throw failure; }).then(
				() => assert.fail('Expected the owned operation to reject'),
				(error) => assert.strictEqual(error, failure)
			);
			await settled();
		} finally {
			app.dispose();
		}
		value.current = 'after';
		flushSync();
		assert.deepEqual(logs, ['idle', 'ready']);
	}
});
