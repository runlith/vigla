import type { Command } from '../../types/remote-functions.ts';
import type { RemoteCommandInternals, RemoteImplementation } from '../../types/internal/remote.ts';
import { getRequestStore } from '../scope.ts';
import { server_api_unavailable } from '../errors.ts';
import { createValidator, execute } from './shared.ts';
import * as errors from './errors.ts';

export const command: Command = (validation: any, implementation?: RemoteImplementation): any => {
	const fn = implementation ?? validation;
	const internals: RemoteCommandInternals = {
		type: 'command',
		id: '',
		name: '',
		validate: createValidator(validation, implementation),
		implementation: fn
	};
	const invoke = (arg: unknown) => {
		const store = getRequestStore();
		if (store.remote.query || store.remote.prerender) errors.commandReadonly(internals.name);
		if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(store.event.request.method)) {
			errors.commandMethod(internals.name, store.event.request.method);
		}
		if (store.state.isRendering) errors.commandRender(internals.name);
		const result = execute(store, { mutation: true }, true, () => internals.validate(arg), fn);
		return Object.assign(result, {
			updates: () => server_api_unavailable({ name: `${internals.name}(...).updates(...)` })
		});
	};
	return Object.defineProperties(invoke, { __: { value: internals }, pending: { get: () => 0 } });
};
