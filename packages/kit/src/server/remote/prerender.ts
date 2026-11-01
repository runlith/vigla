import type { Prerender } from '../../types/remote-functions.ts';
import type { PrerenderOptions } from '../../types/remote.ts';
import type {
	RemoteImplementation,
	RemotePrerenderInternals,
	RemoteResponse
} from '../../types/internal/remote.ts';
import { encodeArgument } from '../../shared/remote.ts';
import { deserialize, serialize } from '../../shared/serialization.ts';
import { getRequestStore } from '../scope.ts';
import { HandledError } from '../failure.ts';
import { createValidator, execute } from './shared.ts';
import { resource } from './resource.ts';

export const prerender: Prerender = (
	validation: any,
	fnOrOptions?: RemoteImplementation | PrerenderOptions<any>,
	options?: PrerenderOptions<any>
): any => {
	const implementation = typeof fnOrOptions === 'function' ? fnOrOptions : undefined;
	const fn = implementation ?? validation;
	const settings =
		options ?? (implementation ? undefined : (fnOrOptions as PrerenderOptions<any> | undefined));
	const validate = createValidator(validation, implementation);
	const internals: RemotePrerenderInternals = {
		type: 'prerender',
		id: '',
		name: '',
		validate,
		implementation: fn,
		has_arg: !!implementation,
		inputs: settings?.inputs,
		dynamic: settings?.dynamic
	};
	const invoke = (arg: unknown) => {
		const store = getRequestStore();
		const payload = encodeArgument(arg, store.hooks.transport);
		const path = `/${store.manifest.app_path}/remote/${internals.id}${payload ? `/${payload}` : ''}`;
		return resource(store, internals, payload, async () => {
			if (
				!store.state.prerendering &&
				!store.options.dev &&
				!store.event.isRemoteRequest &&
				internals.id
			) {
				let response: RemoteResponse | undefined;
				try {
					const result = await fetch(new URL(path, store.event.request.url), {
						redirect: 'manual'
					});
					if (result.ok) response = (await result.json()) as RemoteResponse;
				} catch {}
				if (response?.type === 'error') throw new HandledError(response.error);
				if (response?.type === 'result' && typeof response.data === 'string') {
					return deserialize(response.data, store.hooks.transport)._;
				}
			}
			const prerendering = store.state.prerendering;
			const responses = prerendering ? (prerendering.remoteResponses ??= new Map()) : undefined;
			let pending = responses?.get(path);
			if (!pending) {
				pending = execute(store, { prerender: true }, false, () => validate(arg), fn);
				responses?.set(path, pending);
			}
			const result = await pending;
			if (prerendering && internals.id) {
				const body = { type: 'result', data: serialize({ _: result }, store.hooks.transport) };
				prerendering.dependencies.set(path, {
					response: Response.json(body),
					body: JSON.stringify(body)
				});
			}
			return result;
		});
	};
	return Object.defineProperty(invoke, '__', { value: internals });
};
