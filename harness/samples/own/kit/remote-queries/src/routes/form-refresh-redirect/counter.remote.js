import { redirect } from '@sveltejs/kit';
import { form, query } from '$app/server';
import { state } from './state.js';

export const counter = query(() => {
	if (state.n > 1) redirect(303, '/form-refresh-redirect/reset');
	return state.n;
});

export const increment = form(async () => {
	state.n++;
	await counter().refresh();
});
