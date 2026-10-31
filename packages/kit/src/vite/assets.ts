import type { IncomingMessage, ServerResponse } from 'node:http';
import { serveFile } from '../node/static.ts';
import { escapeHtml } from '../shared/escape.ts';
import { negotiate } from '../shared/http.ts';
import type { Project } from './project.ts';

export function serveAsset(
	project: Project,
	request: IncomingMessage,
	response: ServerResponse,
	pathname: string
): boolean {
	const prefix = project.config.paths.assets ? '/_svelte_kit_assets' : project.config.paths.base;
	if (!pathname.startsWith(prefix + '/')) return false;
	return serveFile({
		directory: project.config.files.assets,
		pathname: pathname.slice(prefix.length),
		request,
		response
	});
}

export function outsideBase(
	request: IncomingMessage,
	response: ServerResponse,
	base: string
): void {
	const html =
		negotiate(request.headers.accept ?? '*', ['text/plain', 'text/html']) === 'text/html';
	if (request.url === '/' && html) {
		response.writeHead(307, { location: base });
		response.end();
		return;
	}
	const target = escapeHtml(base + request.url);
	response.writeHead(404, {
		'content-type': html ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8'
	});
	response.end(
		`The server is configured with a public base URL of ${escapeHtml(base)} - did you mean to visit ${html ? `<a href="${escapeHtml(base + request.url, true)}">${target}</a>` : target} instead?`
	);
}
