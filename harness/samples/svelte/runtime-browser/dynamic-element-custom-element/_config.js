import { flushSync } from 'svelte';
import { test } from '@dromon/harness/helpers';

export default test({
	mode: ['client'],

	props: {
		tag: /** @type {string | null} */ ('my-custom-element'),
		name: /** @type {string | null | undefined} */ (null)
	},
	html: `
		<my-custom-element id="a">Hello null!</my-custom-element>
		<my-custom-element id="b">Hello null!</my-custom-element>
	`,

	test({ assert, component, target }) {
		flushSync(() => (component.name = undefined));
		assert.htmlEqual(
			target.innerHTML,
			`<my-custom-element id="a">Hello undefined!</my-custom-element>
			 <my-custom-element id="b">Hello undefined!</my-custom-element>`
		);

		flushSync(() => (component.name = 'foo'));
		assert.htmlEqual(
			target.innerHTML,
			`<my-custom-element id="a">Hello foo!</my-custom-element>
			 <my-custom-element id="b">Hello foo!</my-custom-element>`
		);

		flushSync(() => (component.tag = null));
		assert.htmlEqual(target.innerHTML, '<my-custom-element id="b">Hello foo!</my-custom-element>');

		flushSync(() => (component.tag = 'div'));
		assert.htmlEqual(
			target.innerHTML,
			`<div name="foo" id="a"></div>
			 <my-custom-element id="b">Hello foo!</my-custom-element>`
		);

		flushSync(() => (component.tag = 'my-custom-element'));
		assert.htmlEqual(
			target.innerHTML,
			`<my-custom-element id="a">Hello foo!</my-custom-element>
			 <my-custom-element id="b">Hello foo!</my-custom-element>`
		);
	}
});
