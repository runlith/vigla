import { command, getRequestEvent } from '$app/server';

export const routeInfo = command(() => {
	const event = getRequestEvent();
	return `${event.route.id} ${event.url.pathname}`;
});
