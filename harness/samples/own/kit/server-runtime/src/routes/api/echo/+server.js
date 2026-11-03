export function GET({ request }) {
	return new Response(request.headers.get('x-token') ?? 'none');
}
