import { expect, test } from 'vitest';
import { mount, root, settled, unmount } from 'vigla';
import { boundary } from 'vigla/internal/client';

test('a mount transform reaches a template boundary under a public owner', async () => {
	for (const nested of [false, true]) {
		const target = document.createElement('main');
		document.body.append(target);
		const parent = nested ? root() : null;
		const component = (anchor: ChildNode) => {
			const node = document.createComment('');
			anchor.before(node);
			boundary(
				node,
				{ failed: (at, error) => at.before(document.createTextNode(String(error()))) },
				() => {
					throw new Error('raw');
				}
			);
		};
		const render = () => mount(component, { target, transformError: async () => 'mapped' });
		const instance = parent ? parent.run(render) : render();
		await settled();
		await Promise.resolve();
		try {
			expect(target.textContent, `nested=${nested}`).toBe('mapped');
		} finally {
			await unmount(instance);
			parent?.dispose();
			target.remove();
		}
	}
});
