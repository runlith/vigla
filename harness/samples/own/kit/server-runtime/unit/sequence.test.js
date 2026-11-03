import { sequence } from '@sveltejs/kit/hooks';
import { expect, test } from 'vitest';

test('sequence runs its handlers outside a request', async () => {
	const order = [];
	const handle = sequence(
		async ({ event, resolve }) => {
			order.push('first');
			return resolve(event);
		},
		async ({ event, resolve }) => {
			order.push('second');
			return resolve(event);
		}
	);
	const response = await handle({
		event: { url: new URL('http://localhost/') },
		resolve: async () => new Response('ok')
	});
	expect(await response.text()).toBe('ok');
	expect(order).toEqual(['first', 'second']);
});
