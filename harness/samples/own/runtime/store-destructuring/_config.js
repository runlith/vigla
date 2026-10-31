import { flushSync } from 'svelte';
import { test } from '@vigla/harness/helpers';

export default test({
	html: '<p>0/0//false</p><button>update</button><button>object</button>',
	test({ assert, target }) {
		const [update, object] = target.querySelectorAll('button');
		flushSync(() => update.click());
		assert.htmlEqual(target.innerHTML, '<p>2/0/3,4/true</p><button>update</button><button>object</button>');
		flushSync(() => object.click());
		assert.htmlEqual(target.innerHTML, '<p>2/42/3,4/true</p><button>update</button><button>object</button>');
	}
});
