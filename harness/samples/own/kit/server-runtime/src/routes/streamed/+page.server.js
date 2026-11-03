export const prerender = true;

export function load() {
	return { streamed: new Promise((resolve) => setTimeout(() => resolve('late'), 100)) };
}
