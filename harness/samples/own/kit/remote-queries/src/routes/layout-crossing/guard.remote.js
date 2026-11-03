import { redirect } from '@sveltejs/kit';
import { query } from '$app/server';

export const guard = query(() => {
	redirect(307, '/layout-crossing-login');
});
