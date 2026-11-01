import type { StandardSchemaV1 } from '@standard-schema/spec';
import { DEV } from 'esm-env';
import type { OpenFields, RemoteFormIssue } from '../types/fields.ts';
import type { InternalFormIssue } from '../types/internal/remote.ts';
import { throwDiagnostic, warnDiagnostic } from './diagnostics.ts';
import * as errors from './errors.ts';

export type { InternalFormIssue } from '../types/internal/remote.ts';

export interface FormKey {
	name: string;
	type: 'number' | 'boolean' | null;
	isArray: boolean;
}
export const DELETE_KEY = {};

export function splitPath(path: string): string[] {
	if (!/^[a-zA-Z_$]\w*(\.[a-zA-Z_$]\w*|\[\d+\])*$/.test(path)) {
		errors.form_field_invalid_name({ name: path });
	}
	return path.split(/\.|\[|\]/).filter(Boolean);
}

export function parseFormKey(formId: string, key: string): FormKey {
	const suffix = `/${formId}`;
	let name = key;
	let coordinate = '';
	if (name.startsWith('i:') && (name.endsWith(`${suffix}.x`) || name.endsWith(`${suffix}.y`))) {
		coordinate = name.slice(-1);
		name = name.slice(0, -2);
	}
	if (!name.endsWith(suffix)) errors.form_field_unbound({ name });
	name = name.slice(0, -suffix.length);
	let type: FormKey['type'] = null;
	if (/^[nbi]:/.test(name)) {
		type = name.startsWith('b:') ? 'boolean' : 'number';
		name = name.slice(2);
	}
	const isArray = name.endsWith('[]');
	if (isArray) name = name.slice(0, -2);
	return { name: coordinate ? `${name}.${coordinate}` : name, type, isArray };
}

export function coerceFormValue(type: FormKey['type'], value: any): any {
	if (Array.isArray(value)) return value.map((entry) => coerceFormValue(type, entry));
	if (type === 'number') return value === '' ? undefined : parseFloat(value);
	if (type === 'boolean') return value === 'on';
	return value;
}

export function deepSet(
	object: Record<string, any>,
	path: Array<string | number>,
	value: any
): void {
	let current = object;
	for (let index = 0; index < path.length; index++) {
		const key = path[index]!;
		if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
			errors.form_field_forbidden_key({ key });
		}
		if (index === path.length - 1) {
			if (value === DELETE_KEY) delete current[key];
			else current[key] = value;
			return;
		}
		const next = String(path[index + 1]);
		const isArray = /^\d+$/.test(next);
		const inner = Object.hasOwn(current, key) ? current[key] : undefined;
		if (inner != null && Array.isArray(inner) !== isArray)
			errors.form_field_array_conflict({ key: next });
		if (inner == null) {
			if (value === DELETE_KEY) return;
			current[key] = isArray ? [] : {};
		}
		current = current[key];
	}
}

export function setNestedValue(object: Record<string, any>, field: FormKey, value: any): void {
	deepSet(object, splitPath(field.name), value);
}

export function deepGet(object: Record<string, any>, path: Array<string | number>): any {
	let current = object;
	for (const key of path) {
		if (current === null || typeof current !== 'object' || !Object.hasOwn(current, key))
			return undefined;
		current = current[key];
	}
	return current;
}

export function buildPath(path: Array<string | number>): string {
	return path.reduce<string>(
		(name, key) =>
			typeof key === 'number' ? `${name}[${key}]` : `${name}${name ? '.' : ''}${key}`,
		''
	);
}

export function normalizeIssue(issue: StandardSchemaV1.Issue, server = false): InternalFormIssue {
	const path = (issue.path ?? []).map(
		(segment) => (typeof segment === 'object' ? segment.key : segment) as string | number
	);
	return { name: buildPath(path), path, message: issue.message, server };
}

export function flattenIssues(issues: InternalFormIssue[]): Record<string, InternalFormIssue[]> {
	const result: Record<string, InternalFormIssue[]> = Object.create(null);
	for (const issue of issues) {
		(result.$ ??= []).push(issue);
		for (let length = 1; length <= issue.path.length; length++) {
			(result[buildPath(issue.path.slice(0, length))] ??= []).push(issue);
		}
	}
	return result;
}

export interface FieldContext {
	id: string;
	get(): Record<string, any>;
	set(path: (string | number)[], value: any): void;
	issues(path?: (string | number)[], all?: boolean): Record<string, InternalFormIssue[]>;
	touched(): Record<string, boolean>;
	dirty(): Record<string, boolean>;
}

type Path = (string | number)[];

function clone(value: any): any {
	if (value === null || typeof value !== 'object') return value;
	if (value instanceof Date) return new Date(value.getTime());
	if (typeof File !== 'undefined' && value instanceof File) return value;
	if (Array.isArray(value)) return value.map(clone);
	const result: Record<string, any> = {};
	for (const key of Object.keys(value)) result[key] = clone(value[key]);
	return result;
}

function publicIssue(issue: InternalFormIssue): RemoteFormIssue {
	return { path: issue.path, message: issue.message };
}

function hasChange(changes: Record<string, boolean>, key: string): boolean {
	if (Object.hasOwn(changes, key)) return true;
	for (const candidate of Object.keys(changes)) {
		if (key === '') return true;
		if (
			candidate.startsWith(key) &&
			(candidate[key.length] === '.' || candidate[key.length] === '[')
		) {
			return true;
		}
	}
	return false;
}

function missingValue(type: string): never {
	throwDiagnostic('form_input_missing_value', `${type} inputs must have a value`, missingValue);
}

function inputAttributes(
	context: FieldContext,
	path: Path,
	type: string,
	option?: any,
	checked?: boolean
): Record<string, any> {
	const key = buildPath(path);
	const multiple =
		type === 'file multiple' ||
		type === 'select multiple' ||
		(type === 'checkbox' && typeof option === 'string');
	let prefix = '';
	if (type === 'number' || type === 'range') prefix = 'n:';
	else if (type === 'image') prefix = 'i:';
	else if (type === 'checkbox' && !multiple) prefix = 'b:';
	else if (type === 'hidden' || type === 'submit') {
		if (typeof option === 'number') prefix = 'n:';
		else if (typeof option === 'boolean') prefix = 'b:';
	}

	const attributes: Record<string, any> = {
		name: `${prefix}${key}${multiple ? '[]' : ''}/${context.id}`,
		get 'aria-invalid'() {
			return key in context.issues() ? 'true' : undefined;
		}
	};
	if (type !== 'text' && type !== 'select' && type !== 'select multiple') {
		attributes.type = type === 'file multiple' ? 'file' : type;
	}
	const read = (fallback?: any): any => {
		const value = deepGet(context.get(), path);
		if (value != null) return value;
		return fallback !== undefined && Object.hasOwn(context.dirty(), key) ? undefined : fallback;
	};

	if (type === 'hidden' || type === 'submit') {
		if (DEV && option == null) missingValue(`\`${type}\``);
		attributes.value = typeof option === 'boolean' ? (option ? 'on' : 'off') : option;
		return attributes;
	}
	if (type === 'select' || type === 'select multiple') {
		attributes.multiple = multiple;
		Object.defineProperty(attributes, 'value', {
			enumerable: true,
			get() {
				const value = read(option);
				return Array.isArray(value) ? [...value] : value;
			}
		});
		return attributes;
	}
	if (type === 'checkbox' || type === 'radio') {
		const hasOption = type === 'radio' || multiple;
		if (DEV && hasOption && !option) missingValue(type === 'radio' ? 'Radio' : 'Checkbox array');
		if (hasOption) attributes.value = option ?? 'on';
		else checked = option;
		attributes.defaultChecked = checked;
		Object.defineProperty(attributes, 'checked', {
			enumerable: true,
			get() {
				const value = read();
				if (value == null) return read(checked);
				if (type === 'radio') return value === option;
				if (multiple) return value.includes(option);
				return value;
			}
		});
		return attributes;
	}
	if (type === 'file' || type === 'file multiple') {
		attributes.multiple = multiple;
		Object.defineProperty(attributes, 'files', {
			enumerable: true,
			get() {
				const value = read();
				const files = typeof File !== 'undefined' && value instanceof File ? [value] : value;
				if (
					typeof File === 'undefined' ||
					!Array.isArray(files) ||
					!files.every((file) => file instanceof File)
				)
					return null;
				if (typeof DataTransfer === 'undefined')
					return Object.assign({ length: files.length }, files);
				const transfer = new DataTransfer();
				for (const file of files) transfer.items.add(file);
				return transfer.files;
			}
		});
		return attributes;
	}
	if (type === 'image') return attributes;
	attributes.defaultValue = option;
	Object.defineProperty(attributes, 'value', {
		enumerable: true,
		get: () => String(read(option) ?? '')
	});
	return attributes;
}

function method(context: FieldContext, path: Path, name: string): Function | undefined {
	switch (name) {
		case 'set':
			return (value: any) => {
				context.set(path, value);
				return value;
			};
		case 'value':
			return () => clone(deepGet(context.get(), path));
		case 'issues':
		case 'allIssues': {
			const key = buildPath(path);
			const all = name === 'allIssues';
			return () => {
				const issues = context.issues(path, all)[key || '$'];
				if (all) return issues?.map(publicIssue);
				const own = issues?.filter((issue) => issue.name === key).map(publicIssue);
				return own?.length ? own : undefined;
			};
		}
		case 'touched':
		case 'dirty': {
			const key = buildPath(path);
			return () => hasChange(name === 'dirty' ? context.dirty() : context.touched(), key);
		}
		case 'as':
			return (type: string, option?: any, checked?: boolean) =>
				inputAttributes(context, path, type, option, checked);
	}
}

const warnedSites = new Set<string | undefined>();

function warnEnumeration(): void {
	const stack = new Error().stack;
	if (warnedSites.has(stack)) return;
	warnedSites.add(stack);
	warnDiagnostic(
		'form_fields_enumerated',
		'The properties of `form.fields` are virtual, so operators like `in` and `Object.keys` are meaningless. If you need the current value of a form field, use `form.fields.x.value()`'
	);
}

function field(context: FieldContext, path: Path, target: object): any {
	return new Proxy(target, {
		get(target, property) {
			if (typeof property === 'symbol') return Reflect.get(target, property);
			const segment = /^\d+$/.test(property) ? Number.parseInt(property, 10) : property;
			return field(context, [...path, segment], method(context, path, property) ?? {});
		},
		has(target, property) {
			if (DEV && typeof property !== 'symbol') warnEnumeration();
			return Reflect.has(target, property);
		},
		ownKeys(target) {
			if (DEV) warnEnumeration();
			return Reflect.ownKeys(target);
		}
	});
}

export function createFields(context: FieldContext): OpenFields {
	return field(context, [], {});
}
