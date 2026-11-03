export async function load({ fetch, url }) {
	const request = new Request(new URL('/api/echo', url));
	const response = await fetch(request, { headers: { 'x-token': 'from-init' } });
	return { token: await response.text() };
}
