import { flushSync } from 'svelte';
import { test } from '@dromon/harness/helpers';

export default test({
	async test({ assert, target, component }) {
		const [b1] = target.querySelectorAll('button');
		assert.htmlEqual(target.innerHTML, '<div>abc</div><button>Toggle</button>');
		flushSync(() => {
			b1.click();
		});
		assert.htmlEqual(target.innerHTML, '<div>Fallback</div><button>Toggle</button>');
		flushSync(() => {
			b1.click();
		});
		assert.htmlEqual(target.innerHTML, '<div>abc</div><button>Toggle</button>');
	}
});
