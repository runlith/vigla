import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	mode: ['client'],
	async test({ assert, instance, raf, target }) {
		const button = target.querySelector('button');
		const captured = (name) => JSON.parse(button.dataset[name]);
		flushSync(() => instance.select(false, 2));
		for (const name of ['options', 'deferred', 'css', 'start']) {
			assert.deepEqual(captured(name), [1, 10, 2, 20]);
		}
		raf.tick(25);
		assert.deepEqual(captured('tick'), [1, 10, 2, 20]);

		flushSync(() => instance.select(false, 3));
		assert.deepEqual(instance.read(), [1, 10, 3, 30]);
		assert.equal(instance.unread(), 100);
		assert.deepEqual(await instance.timer(), [1, 10, 3, 30]);
		window.dispatchEvent(new MessageEvent('message'));
		assert.deepEqual(captured('event'), [1, 10, 3, 30]);
		assert.deepEqual(instance.write(4), [1, 10, 4, 40]);
		flushSync();

		flushSync(() => instance.select(true, 5));
		assert.deepEqual(captured('tick'), [5, 50, 5, 50]);
		assert.deepEqual(instance.read(), [5, 50, 5, 50]);
		flushSync(() => instance.select(false, 6));
		assert.deepEqual(captured('options'), [5, 50, 6, 60]);
		instance.restartOnEnd();
		raf.tick(125);
		assert.deepEqual(captured('final'), [5, 50, 6, 60]);
		assert.deepEqual(captured('end'), [5, 50, 6, 60]);
		assert.equal(target.querySelector('button'), button);
		assert.deepEqual(captured('options'), [7, 70, 8, 80]);
		raf.tick(225);
		assert.deepEqual(captured('final'), [7, 70, 8, 80]);
		assert.deepEqual(captured('end'), [7, 70, 8, 80]);
		assert.htmlEqual(target.innerHTML, '');
	}
});
