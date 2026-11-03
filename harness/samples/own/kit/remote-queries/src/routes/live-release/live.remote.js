import { getRequestEvent, query } from '$app/server';
import { state } from './state.js';

export const ticker = query.live('unchecked', async function* (id) {
	const signal = getRequestEvent().request.signal;
	state.open += 1;
	try {
		yield id;
		await new Promise((resolve) => signal.addEventListener('abort', resolve, { once: true }));
	} finally {
		state.open -= 1;
	}
});
