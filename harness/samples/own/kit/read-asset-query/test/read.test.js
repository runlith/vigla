import { expect, test } from './gate.js';

test('read serves assets whose URL keeps a query', async ({ request }) => {
	const response = await request.get('/read');
	expect(response.status()).toBe(200);
	expect(await response.json()).toEqual({
		queried: 'asset text\n',
		uninlined: 'asset text\n',
		hashed: 'asset text\n'
	});
});
