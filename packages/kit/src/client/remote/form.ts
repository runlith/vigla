import { cell, getOwner, onDestroy, tick, type Owner } from 'vigla';
import { proxy } from 'vigla/internal/client';
import { createAttachmentKey } from 'vigla/attachments';
import { DEV } from 'esm-env';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import type {
	FormAttributes,
	FormValidationOptions,
	RemoteForm,
	RemoteFormEnhanceCallback,
	RemoteFormEnhanceInstance
} from '../../types/remote-form.ts';
import type { OpenFields } from '../../types/fields.ts';
import type { InternalFormIssue, RemoteFormResult } from '../../types/internal/remote.ts';
import type { UpdatingPromise } from '../../types/remote.ts';
import {
	BINARY_FORM_CONTENT_TYPE,
	convertFormData,
	serializeBinaryForm
} from '../../shared/form-data.ts';
import {
	buildPath,
	createFields,
	deepGet,
	deepSet,
	flattenIssues,
	normalizeIssue,
	splitPath
} from '../../shared/form-fields.ts';
import { throwDiagnostic, warnDiagnostic } from '../../shared/diagnostics.ts';
import { client } from '../client.ts';
import { updating } from './updates.ts';
import type { Remotes } from './cache.ts';
import { attach, formData, validateFormData } from './form-element.ts';

const attachment = createAttachmentKey();

export function formError(
	code:
		| 'remote_form_multiple_elements'
		| 'remote_form_not_attached'
		| 'remote_form_reserved_field'
		| 'remote_form_mixed_inputs'
		| 'remote_form_multiple_files'
): never {
	if (DEV) {
		const messages = {
			remote_form_multiple_elements:
				'A remote form instance can only be attached to one form element',
			remote_form_not_attached:
				'The remote form must be attached to a form element before submitting',
			remote_form_reserved_field: 'Remote form field names cannot begin with $',
			remote_form_mixed_inputs: 'All inputs of an array field must have the same type',
			remote_form_multiple_files: 'Use file multiple for an input with multiple files'
		};
		throwDiagnostic(code, messages[code], formError);
	}
	throw new Error(`https://svelte.dev/e/kit/${code}`);
}

interface Instance {
	form: Form;
	holders: Set<Owner>;
	pending: number;
}

export class Forms {
	readonly remote: Remotes;
	readonly id: string;
	readonly #instances = new Map<string | number, Instance>();
	readonly #default: Form;
	schema?: StandardSchemaV1;

	constructor(remote: Remotes, id: string) {
		this.remote = remote;
		this.id = id;
		this.#default = new Form(this);
	}

	get(key?: string | number): Form {
		if (key === undefined) return this.#default;
		const holder = getOwner();
		const entry = this.#instances.get(key) ?? {
			form: this.remote.owner.run(() => new Form(this, key)),
			holders: new Set<Owner>(),
			pending: 0
		};
		if (holder && !entry.holders.has(holder)) {
			this.#instances.set(key, entry);
			entry.holders.add(holder);
			holder.run(() =>
				onDestroy(() => {
					entry.holders.delete(holder);
					if (!entry.holders.size && !entry.pending && this.#instances.get(key) === entry)
						this.#instances.delete(key);
				})
			);
		}
		return entry.form;
	}

	retain(form: Form): () => void {
		if (form.key === undefined) return () => {};
		const key = form.key;
		const entry = this.#instances.get(key) ?? { form, holders: new Set<Owner>(), pending: 0 };
		this.#instances.set(key, entry);
		entry.pending++;
		return () => {
			entry.pending--;
			if (!entry.holders.size && !entry.pending && this.#instances.get(key) === entry)
				this.#instances.delete(key);
		};
	}
}

export class Form {
	readonly forms: Forms;
	readonly key: string | number | undefined;
	readonly instance: RemoteForm<any, any>;
	readonly fields: OpenFields;
	readonly #input = cell<Record<string, any>>(proxy({}));
	readonly #issues = cell<InternalFormIssue[]>([]);
	readonly #result = cell<any>(undefined);
	readonly #pending = cell(0);
	readonly #submitted = cell(false);
	readonly #touched = cell<Record<string, boolean>>({});
	readonly #dirty = cell<Record<string, boolean>>({});
	#canValidate: Record<string, boolean> = {};
	#schema?: StandardSchemaV1;
	#validation = 0;
	#unread: InternalFormIssue[] | null = null;
	#enhance: RemoteFormEnhanceCallback<any, any> = async (instance) => {
		if (await instance.submit()) {
			await tick();
			if (instance.element.isConnected) HTMLFormElement.prototype.reset.call(instance.element);
		}
	};
	element: HTMLFormElement | null = null;

	constructor(forms: Forms, key?: string | number) {
		this.forms = forms;
		this.key = key;
		this.fields = createFields({
			id: forms.id,
			get: () => this.#input.current,
			set: (path, value) => this.write(path, value, this.element !== null),
			issues: (path, all) => {
				if (path && this.#unread)
					this.#unread = this.#unread.filter(
						(issue) =>
							(all ? issue.path.slice(0, path.length) : issue.path).join('.') !== path.join('.')
					);
				return flattenIssues(this.#issues.current);
			},
			touched: () => this.#touched.current,
			dirty: () => this.#dirty.current
		});
		const seed = forms.remote.seed(this.actionId);
		const initialize = (value: RemoteFormResult | undefined): void => {
			if (!value) return;
			this.#input.current = proxy(value.input ?? {});
			this.#issues.current = value.issues ?? [];
			this.#result.current = value.result;
		};
		if (seed instanceof Promise) void seed.then((node) => initialize(node.v));
		else initialize(seed?.v);
		const form = this;
		this.instance = Object.defineProperties(
			{
				method: 'POST' as const,
				get action() {
					return form.action;
				},
				[attachment]: (element: HTMLFormElement) => this.attach(element)
			},
			{
				element: { get: () => this.element },
				fields: { get: () => this.fields },
				pending: { get: () => this.#pending.current },
				submitted: { get: () => this.#submitted.current },
				result: { get: () => this.#result.current },
				submit: { value: () => this.submit() },
				validate: { value: (options?: FormValidationOptions) => this.validate(options) },
				preflight: {
					value: (schema: StandardSchemaV1) => {
						this.#schema = schema;
						if (key === undefined) forms.schema = schema;
						return this.instance;
					}
				},
				enhance: {
					value: (callback: RemoteFormEnhanceCallback<any, any>) => {
						this.#enhance = callback;
						return this.instance;
					}
				},
				...(key === undefined
					? { for: { value: (key: string | number) => forms.get(key).instance } }
					: {})
			}
		) as unknown as RemoteForm<any, any>;
	}

	get actionId(): string {
		return this.forms.id + (this.key === undefined ? '' : `/${JSON.stringify(this.key)}`);
	}
	get action(): string {
		const params = new URLSearchParams(this.forms.remote.client.state.page.url.search);
		params.delete('/remote');
		const search = params.toString();
		return `?${search ? `${search}&` : ''}/remote=${encodeURIComponent(this.actionId)}`;
	}

	convert(data: FormData): Record<string, any> {
		const value = convertFormData(this.forms.id, data);
		if (this.key !== undefined && !('id' in value)) value.id = this.key;
		return value;
	}

	write(path: (string | number)[], value: any, interactive = false): void {
		if (!path.length) {
			this.#input.current = proxy(value);
			return;
		}
		if (value === deepGet(this.#input.current, path)) return;
		deepSet(this.#input.current, path, value);
		if (interactive) {
			const key = buildPath(path);
			this.#dirty.current = { ...this.#dirty.current, [key]: true };
			this.#touched.current = { ...this.#touched.current, [key]: true };
			this.#canValidate[key] = true;
		}
	}

	input(name: string, value: any): void {
		this.write(splitPath(name), value);
		this.#dirty.current = { ...this.#dirty.current, [name]: true };
	}
	touch(name: string): void {
		this.#touched.current = { ...this.#touched.current, [name]: true };
		if (Object.hasOwn(this.#dirty.current, name)) this.#canValidate[name] = true;
	}
	reset(data?: FormData): void {
		if (data) this.#input.current = proxy(convertFormData(this.forms.id, data));
		this.#issues.current = [];
		this.#dirty.current = {};
		this.#touched.current = {};
		this.#canValidate = {};
		this.#submitted.current = false;
	}

	#warn(): void {
		if (!DEV) return;
		this.#unread = this.#issues.current;
		setTimeout(() => {
			if (this.#unread?.length)
				warnDiagnostic(
					'remote_form_issues_ignored',
					this.#unread
						.map((issue) =>
							issue.path.length ? `${issue.name} (${issue.message})` : issue.message
						)
						.join('\n')
				);
			this.#unread = null;
		});
	}

	#merge(issues: InternalFormIssue[]): void {
		const names = new Set(issues.map((issue) => issue.name));
		this.#issues.current = [
			...this.#issues.current.filter((issue) => issue.server && !names.has(issue.name)),
			...issues
		];
	}

	async #preflight(data: FormData): Promise<boolean> {
		const schema = this.#schema ?? this.forms.schema;
		const result = await schema?.['~standard'].validate(this.convert(data));
		if (result?.issues) {
			this.#merge(result.issues.map((issue) => normalizeIssue(issue)));
			this.#warn();
			return false;
		}
		if (schema) this.#issues.current = this.#issues.current.filter((issue) => issue.server);
		return true;
	}

	#send(data: FormData, preflight: boolean): UpdatingPromise<boolean> {
		const remote = this.forms.remote;
		const release = this.forms.retain(this);
		const promise = updating(remote, async (updates) => {
			try {
				if (preflight && !(await this.#preflight(data))) return false;
				const response = await remote.channel.request(
					remote.channel.url(this.forms.id),
					{
						method: 'POST',
						headers: { 'Content-Type': BINARY_FORM_CONTENT_TYPE, ...remote.channel.headers() },
						body: serializeBinaryForm(this.convert(data), {
							remote_refreshes: [...(updates?.refreshes ?? [])]
						}).blob
					},
					updates?.refreshes
				);
				const result: RemoteFormResult = response._ ?? {};
				this.#issues.current = result.issues ?? [];
				this.#result.current = result.result;
				const refresh = updates === null && !response.r;
				if (response.redirect) {
					await remote.channel.redirect(response.redirect, refresh);
					return true;
				}
				if (this.#issues.current.length) {
					this.#warn();
					return false;
				}
				remote.failMissing(updates?.refreshes);
				if (refresh) await remote.client.invalidate(undefined, true);
				return true;
			} catch (error) {
				this.#result.current = undefined;
				this.#issues.current = [];
				throw error;
			}
		});
		void promise.then(release, release);
		return promise;
	}

	submit(): UpdatingPromise<boolean> {
		if (!this.element) formError('remote_form_not_attached');
		const data = formData(this.element);
		validateFormData(this.element, data);
		this.#submitted.current = true;
		this.#pending.current++;
		const promise = this.#send(data, true);
		void promise
			.finally(() => {
				this.#pending.current--;
			})
			.catch(() => {});
		return promise;
	}

	async enhance(element: HTMLFormElement, data: FormData): Promise<void> {
		this.#submitted.current = true;
		this.#pending.current++;
		try {
			if (!(await this.#preflight(data))) return;
			const descriptors = Object.getOwnPropertyDescriptors(this.instance);
			Reflect.deleteProperty(descriptors, 'enhance');
			const instance = Object.defineProperties(
				{},
				{
					...descriptors,
					element: { value: element },
					submit: { value: () => this.#send(data, false) }
				}
			) as RemoteFormEnhanceInstance<any, any>;
			await this.forms.remote.owner.run(() => this.#enhance(instance));
		} catch (error) {
			const body = await this.forms.remote.error(error);
			await this.forms.remote.client.applyAction({
				type: 'error',
				status: body.status,
				error: body.body
			});
		} finally {
			this.#pending.current--;
		}
	}

	async validate({
		all = false,
		preflightOnly = false
	}: FormValidationOptions = {}): Promise<void> {
		const generation = ++this.#validation;
		await tick();
		if (!this.element) return;
		const data = formData(this.element);
		const input = this.convert(data);
		const schema = this.#schema ?? this.forms.schema;
		const validated = await schema?.['~standard'].validate(input);
		if (generation !== this.#validation) return;
		let issues = validated?.issues?.map((issue) => normalizeIssue(issue)) ?? [];
		const fromServer = !validated?.issues && !preflightOnly;
		if (fromServer) {
			const remote = this.forms.remote;
			const response = await remote.channel.request(remote.channel.url(this.forms.id), {
				method: 'POST',
				headers: { 'Content-Type': BINARY_FORM_CONTENT_TYPE, ...remote.channel.headers() },
				body: serializeBinaryForm(input, { validate_only: true }).blob
			});
			if (generation !== this.#validation) return;
			issues = response._;
		}
		if (!all && !this.#submitted.current)
			issues = issues.filter((issue) => this.#canValidate[issue.name]);
		if (fromServer) this.#issues.current = issues;
		else this.#merge(issues);
	}

	attach(element: HTMLFormElement): () => void {
		if (this.element) formError('remote_form_multiple_elements');
		this.element = element;
		this.#dirty.current = {};
		this.#touched.current = {};
		this.#canValidate = {};
		const release = this.forms.retain(this);
		const detach = attach(this, element);
		return () => {
			detach();
			this.element = null;
			release();
		};
	}
}

export function form(id: string): RemoteForm<any, any> {
	const current = () => client('form').remote.forms(id).get().instance;
	const attributes: FormAttributes = {
		method: 'POST',
		get action() {
			return current().action;
		},
		[attachment]: (element: HTMLFormElement) =>
			client('form').remote.forms(id).get().attach(element)
	};
	return new Proxy(attributes, {
		get(target, key) {
			return Object.hasOwn(target, key) ? Reflect.get(target, key) : Reflect.get(current(), key);
		}
	}) as RemoteForm<any, any>;
}
