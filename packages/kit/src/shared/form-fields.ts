import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { InternalFormIssue } from '../types/internal/remote.ts';
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
