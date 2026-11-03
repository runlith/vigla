import { redirect } from '@sveltejs/kit';
import { calls } from './state.js';

export async function handle({ event, resolve }) {
	if (event.request.headers.has('x-guard')) redirect(303, '/');
	if (event.url.pathname === '/transform')
		return resolve(event, {
			transformPageChunk() {
				calls.transform++;
				throw new Error('transform failed');
			}
		});
	return resolve(event);
}
