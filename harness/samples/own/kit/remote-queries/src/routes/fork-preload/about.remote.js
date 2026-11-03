import { query } from '$app/server';

export const aboutData = query(async () => {
	await new Promise((resolve) => setTimeout(resolve, 200));
	return 'about data';
});
