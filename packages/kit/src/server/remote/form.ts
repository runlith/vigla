import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { Form } from '../../types/remote-functions.ts';
import type { RemoteFormInvalidField } from '../../types/fields.ts';
import type {
	RemoteFormInstance,
	RemoteFormInternals,
	RemoteFormResult,
	RemoteImplementation
} from '../../types/internal/remote.ts';
import {
	createFields,
	deepSet,
	flattenIssues,
	normalizeIssue,
	parseFormKey,
	splitPath
} from '../../shared/form-fields.ts';
import { ActionFailure, ValidationError } from '../../shared/outcomes.ts';
import { getRequestStore } from '../scope.ts';
import { server_api_unavailable } from '../errors.ts';
import { createValidator, execute } from './shared.ts';
import { snapshot } from './resource.ts';
import * as errors from './errors.ts';

function issueProxy(path: Array<string | number> = []): RemoteFormInvalidField<any> {
	return new Proxy((message: string): StandardSchemaV1.Issue => ({ message, path }), {
		get(target, key) {
			if (typeof key === 'symbol') return Reflect.get(target, key);
			return issueProxy([...path, /^\d+$/.test(key) ? Number(key) : key]);
		}
	}) as RemoteFormInvalidField<any>;
}

function issues(
	output: RemoteFormResult,
	failures: readonly StandardSchemaV1.Issue[],
	data: FormData | null,
	id: string
): void {
	output.issues = failures.map((issue) => normalizeIssue(issue, true));
	if (!data) return;
	output.input = {};
	for (const key of new Set(data.keys())) {
		const field = parseFormKey(id, key);
		const path = splitPath(field.name);
		if (path.some((part) => part.startsWith('_'))) continue;
		const entries = data.getAll(key).filter((value) => typeof value === 'string');
		deepSet(output.input, path, field.isArray ? entries : entries[0]);
	}
}

export const form: Form = (validation: any, implementation?: RemoteImplementation): any => {
	const fn = implementation ?? validation;
	const validate = createValidator(validation, implementation);
	const create = (key?: string): RemoteFormInstance => {
		const internals: RemoteFormInternals = {
			type: 'form',
			id: '',
			name: '',
			key,
			validate,
			implementation: fn,
			async fn(data, meta, formData) {
				const store = getRequestStore();
				const output: RemoteFormResult = { submission: true };
				try {
					const input = await (implementation ? validate(data) : undefined);
					if (meta.validate_only) return [];
					output.result = await execute(
						store,
						{ mutation: true },
						true,
						() => input,
						(input) => (implementation ? fn(input, issueProxy()) : fn())
					);
					if (output.result instanceof ActionFailure) errors.formFailure();
				} catch (error) {
					if (error instanceof ActionFailure) errors.formFailure();
					if (!(error instanceof ValidationError)) throw error;
					if (meta.validate_only) return error.issues.map((issue) => normalizeIssue(issue, true));
					issues(output, error.issues, formData, internals.id);
				}
				store.remote.formValues.set(internals, output);
				if (!store.event.isRemoteRequest) {
					const actionId = key ? `${internals.id}/${key}` : internals.id;
					store.remote.implicit.set(actionId, { internals, read: () => Promise.resolve(output) });
					snapshot(store, actionId, () => ({ v: output }));
				}
				return output;
			}
		};
		const instance = { method: 'POST' } as RemoteFormInstance;
		const unavailable = (method: string) => server_api_unavailable({ name: `form.${method}()` });
		Object.defineProperties(instance, {
			__: { value: internals },
			action: {
				enumerable: true,
				get() {
					const store = getRequestStore();
					const search = new URLSearchParams(
						store.state.prerendering ? '' : store.event.url.search
					);
					search.delete('/remote');
					const query = search.toString();
					return `?${query ? `${query}&` : ''}/remote=${internals.id}${key ? `/${encodeURIComponent(key)}` : ''}`;
				}
			},
			fields: {
				get() {
					const store = getRequestStore();
					const read = () => store.remote.formValues.get(internals);
					if (store.state.isRendering && internals.id) {
						const actionId = key ? `${internals.id}/${key}` : internals.id;
						snapshot(store, actionId, () => ({ v: read() }));
					}
					return createFields({
						id: internals.id,
						get: () => read()?.input ?? {},
						set(path, value) {
							const output = read() ?? {};
							if (output.submission) return;
							if (!path.length) output.input = value;
							else deepSet((output.input ??= {}), path, value);
							store.remote.formValues.set(internals, output);
						},
						issues: () => flattenIssues(read()?.issues ?? []),
						touched: () => ({}),
						dirty: () => ({})
					});
				}
			},
			result: { get: () => getRequestStore().remote.formValues.get(internals)?.result },
			pending: { get: () => 0 },
			submitted: { get: () => false },
			element: { get: () => null },
			preflight: { value: () => instance },
			enhance: { value: () => ({ method: instance.method, action: instance.action }) },
			validate: { value: () => unavailable('validate') },
			submit: { value: () => unavailable('submit') }
		});
		if (key === undefined)
			Object.defineProperty(instance, 'for', {
				value(value: string | number) {
					const store = getRequestStore();
					const key = JSON.stringify(value);
					const identity = `${internals.id}|${key}`;
					let keyed = store.remote.forms.get(identity);
					if (!keyed) {
						keyed = create(key);
						keyed.__.id = internals.id;
						keyed.__.name = internals.name;
						store.remote.forms.set(identity, keyed);
					}
					return keyed;
				}
			});
		return instance;
	};
	return create();
};
