import { flushSync } from 'svelte';
import { test } from '@dromon/harness/helpers';

const buttons = '<button>inner</button> <button>outer</button> <button>first</button> <button>reverse</button>';

export default test({
	mode: ['client', 'server', 'async-server'],
	html: `${buttons} <b>yes</b><span>tail</span> <ul><b>1</b><b>2</b></ul>`,
	test({ assert, target }) {
		const [inner, outer, first, reverse] = target.querySelectorAll('button');

		flushSync(() => inner.click());
		assert.htmlEqual(target.innerHTML, `${buttons} <i>no</i><span>tail</span> <ul><b>1</b><b>2</b></ul>`);

		flushSync(() => outer.click());
		assert.htmlEqual(target.innerHTML, `${buttons} <ul><b>1</b><b>2</b></ul>`);

		flushSync(() => first.click());
		assert.htmlEqual(target.innerHTML, `${buttons} <ul><i>1</i><b>2</b></ul>`);

		flushSync(() => reverse.click());
		assert.htmlEqual(target.innerHTML, `${buttons} <ul><b>2</b><i>1</i></ul>`);

		flushSync(() => first.click());
		assert.htmlEqual(target.innerHTML, `${buttons} <ul><i>2</i><i>1</i></ul>`);

		flushSync(() => reverse.click());
		assert.htmlEqual(target.innerHTML, `${buttons} <ul><i>1</i><i>2</i></ul>`);
	}
});
