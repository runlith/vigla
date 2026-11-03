import { command, query, requested } from '$app/server';

export const items = query(async () => 'items');

export const bump = command(async () => {
	await requested(items, 1).refreshAll();
	return 'bumped';
});
