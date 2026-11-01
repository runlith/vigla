import type { ServerNode, RequestStore } from '../types/internal/server.ts';
import { isForm, negotiate } from '../shared/http.ts';
import { serialize } from '../shared/serialization.ts';
import { ActionFailure, HttpError, Redirect } from '../shared/outcomes.ts';
import type { Server } from './index.ts';
import { FrameworkError, handleError } from './failure.ts';
import { runRequest } from './scope.ts';
import * as errors from './errors.ts';
import { handleFormPost } from './remote/handler.ts';

export type ActionResult =
	| { type: 'success' | 'failure'; status: number; location: string; data: unknown }
	| { type: 'redirect'; status: number; location: string }
	| { type: 'error'; location: string; error: unknown };

export function actionLocation(url: URL): string {
	const location = new URL(url);
	for (const key of location.searchParams.keys())
		if (key.startsWith('/')) {
			location.searchParams.delete(key);
			break;
		}
	return (
		(location.pathname.startsWith('//') ? `/.${location.pathname}` : location.pathname) +
		location.search
	);
}

export function wantsActionJson(request: Request): boolean {
	return (
		request.method === 'POST' &&
		negotiate(request.headers.get('accept') ?? '*/*', ['application/json', 'text/html']) ===
			'application/json'
	);
}

export async function runAction(
	server: Server,
	store: RequestStore,
	node?: ServerNode
): Promise<ActionResult> {
	const { event } = store;
	const location = actionLocation(event.url);
	const remote = event.url.searchParams.get('/remote');
	if (remote) return handleFormPost(store, remote);
	if (!node?.actions) {
		event.setHeaders({ allow: 'GET' });
		return { type: 'error', location, error: new FrameworkError(405, 'Method Not Allowed') };
	}
	const actions = node.actions;
	if (actions.default && Object.keys(actions).length > 1) errors.action_default_with_named();
	try {
		const selected = [...new URL(event.request.url).searchParams.keys()].find((key) =>
			key.startsWith('/')
		);
		const name = selected ? selected.slice(1) : 'default';
		if (selected && name === 'default') errors.action_name_reserved();
		if (!Object.hasOwn(actions, name))
			throw new FrameworkError(404, 'Not Found', `No action with name '${name}' found`);
		if (!isForm(event.request))
			throw new FrameworkError(
				415,
				'Unsupported Media Type',
				`Form actions expect form-encoded data — received ${event.request.headers.get('content-type')}`
			);
		const data = await server.tracer.span(
			'sveltekit.form_action',
			{ 'sveltekit.form_action.name': name, 'http.route': event.route.id ?? 'unknown' },
			async (span) => {
				const traced = { ...event, tracing: { ...event.tracing, current: span } };
				return runRequest({ ...store, event: traced }, () => actions[name]!(traced), server.scope);
			}
		);
		if (data instanceof Redirect) errors.action_return_redirect();
		if (data instanceof HttpError) errors.action_return_error();
		if (data instanceof ActionFailure)
			return { type: 'failure', status: data.status, location, data: data.data };
		return { type: 'success', status: 200, location, data };
	} catch (error) {
		if (error instanceof Redirect)
			return { type: 'redirect', status: error.status, location: error.location };
		if (error instanceof ActionFailure) {
			try {
				errors.action_throw_fail();
			} catch (failure) {
				error = failure;
			}
		}
		return { type: 'error', error, location };
	}
}

export function serializeAction(data: unknown, server: Server, id: string): string {
	try {
		return serialize(data, server.hooks.transport);
	} catch (error) {
		if (data instanceof Response) errors.action_response_not_serializable({ id });
		if (error instanceof Error && 'path' in error)
			errors.action_data_not_serializable({
				id,
				message: error.message,
				path: error.path ? `data${error.path}` : ''
			});
		throw error;
	}
}

export async function actionResponse(
	server: Server,
	store: RequestStore,
	result: ActionResult
): Promise<Response> {
	let payload: unknown;
	let status = 200;
	if (result.type === 'error') {
		const error = await handleError(store, result.error);
		payload = { ...result, error };
		status = error.status;
	} else if (result.type === 'redirect') payload = result;
	else if (result.type === 'success' && !result.data)
		payload = { ...result, status: 204, data: undefined };
	else {
		try {
			payload = {
				...result,
				data: serializeAction(result.data, server, store.event.route.id ?? '')
			};
			status = result.status;
		} catch (error) {
			return actionResponse(server, store, { type: 'error', error, location: result.location });
		}
	}
	return Response.json(payload, {
		status,
		headers: { 'x-sveltekit-version': server.options.version.name }
	});
}
