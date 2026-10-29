import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

const row = (text) => `<li><button>${text}</button></li>`;
const page = (left, ...rows) =>
	`<button>filter</button> <button>reverse</button> <p>${left}</p> <ul>${rows.map(row).join('')}</ul>`;

export default test({
	mode: ['client', 'server', 'async-server'],
	html: page('2 left', 'one', 'two', 'three'),
	test({ assert, target }) {
		const [filter, reverse] = target.querySelectorAll('button');
		const rows = () => [...target.querySelectorAll('li')];
		const [one, two, three] = rows();

		flushSync(() => filter.click());
		assert.htmlEqual(target.innerHTML, page('2 left', 'one', 'three'));
		assert.deepEqual(rows(), [one, three]);

		flushSync(() => filter.click());
		assert.htmlEqual(target.innerHTML, page('2 left', 'one', 'two', 'three'));
		const back = rows()[1];
		assert.notEqual(back, two);
		assert.deepEqual(rows(), [one, back, three]);

		flushSync(() => reverse.click());
		assert.htmlEqual(target.innerHTML, page('2 left', 'three', 'two', 'one'));
		assert.deepEqual(rows(), [three, back, one]);

		flushSync(() => one.querySelector('button').click());
		assert.htmlEqual(target.innerHTML, page('1 left', 'three', 'two', 'one'));

		flushSync(() => filter.click());
		assert.htmlEqual(target.innerHTML, page('1 left', 'three'));
		assert.deepEqual(rows(), [three]);

		flushSync(() => three.querySelector('button').click());
		assert.htmlEqual(target.innerHTML, page('all done'));
	}
});
