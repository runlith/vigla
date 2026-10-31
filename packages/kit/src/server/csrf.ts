import { isForm } from '../shared/http.ts';
import type { ServerCsrf, ServerPaths } from '../types/internal/server.ts';

export function csrfResponse(
	request: Request,
	remote: boolean,
	csrf: ServerCsrf,
	paths: ServerPaths
): Response | null {
	if (!remote && !csrf.checkOrigin) return null;
	const origin = request.headers.get('origin');
	const self = paths.origin || new URL(request.url).origin;
	const forbidden = remote
		? request.method !== 'GET' && origin !== self
		: ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) &&
			(!request.headers.has('content-type') || isForm(request)) &&
			origin !== self &&
			(!origin || !csrf.trustedOrigins.includes(origin));
	if (!forbidden) return null;
	const message = remote
		? 'Cross-site remote requests are forbidden'
		: `Cross-site ${request.method} form submissions are forbidden`;
	const json = remote || request.headers.get('accept') === 'application/json';
	return new Response(json ? JSON.stringify({ message }) : message, {
		status: 403,
		headers: { 'content-type': json ? 'application/json' : 'text/plain' }
	});
}
