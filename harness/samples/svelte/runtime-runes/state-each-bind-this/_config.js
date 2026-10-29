import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	async test({ assert, target }) {
		const [btn, btn2, btn3] = target.querySelectorAll('button');

		flushSync(() => {
			btn?.click();
		});

		assert.htmlEqual(
			target.innerHTML,
			`<div><p style="background-color: red;">b1</p><button>change</button><button>delete</button></div><div><p>b2</p><button>change</button><button>delete</button></div>`
		);

		flushSync(() => {
			btn2?.click();
		});

		assert.htmlEqual(
			target.innerHTML,
			`<div><p>b2</p><button>change</button><button>delete</button></div>`
		);

		flushSync(() => {
			btn3?.click();
		});

		assert.htmlEqual(
			target.innerHTML,
			`<div><p style="background-color: red;">b2</p><button>change</button><button>delete</button></div>`
		);
	}
});
