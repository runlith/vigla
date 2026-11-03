import { command, getRequestEvent, query } from '$app/server';
import { state } from './state.js';

export const count = query(() => state.count);

export const liveCount = query.live(async function* () {
	const signal = getRequestEvent().request.signal;
	yield await count();
	while (!signal.aborted) {
		await new Promise((resolve) => {
			state.listeners.add(resolve);
			signal.addEventListener('abort', resolve, { once: true });
		});
		if (signal.aborted) return;
		yield await count();
	}
});

export const bump = command(() => {
	state.count++;
	for (const listener of state.listeners) listener();
	state.listeners.clear();
	return state.count;
});
