import { DEV } from 'esm-env';
import { warn } from './diagnostics.ts';

type Indexed = Record<PropertyKey, unknown>;

function clone(
	value: unknown,
	cloned: Map<object, unknown>,
	path: string,
	paths: string[] | null,
	original: object | null = null
): unknown {
	if (typeof value === 'object' && value !== null) {
		const known = cloned.get(value);
		if (known !== undefined) return known;
		if (value instanceof Map) return new Map(value);
		if (value instanceof Set) return new Set(value);
		if (Array.isArray(value)) {
			const copy: unknown[] = new Array(value.length);
			cloned.set(value, copy);
			if (original !== null) cloned.set(original, copy);
			for (let position = 0; position < value.length; position++) {
				if (!(position in value)) continue;
				const at = paths === null ? path : `${path}[${position}]`;
				copy[position] = clone(value[position], cloned, at, paths);
			}
			return copy;
		}
		if (Object.getPrototypeOf(value) === Object.prototype) {
			const copy: Indexed = {};
			cloned.set(value, copy);
			if (original !== null) cloned.set(original, copy);
			for (const key of Object.keys(value)) {
				const at = paths === null ? path : `${path}.${key}`;
				copy[key] = clone((value as Indexed)[key], cloned, at, paths);
			}
			return copy;
		}
		if (value instanceof Date) {
			value.getTime();
			return structuredClone(value);
		}
		const json = (value as { toJSON?: unknown }).toJSON;
		if (typeof json === 'function') {
			const at = paths === null ? path : `${path}.toJSON()`;
			return clone(json.call(value), cloned, at, paths, value);
		}
	}
	if (typeof EventTarget === 'function' && value instanceof EventTarget) return value;
	try {
		return structuredClone(value);
	} catch {
		paths?.push(path);
		return value;
	}
}

function uncloneable(paths: readonly string[]): void {
	if (paths.length === 1 && paths[0] === '') {
		warn(
			'state_snapshot_uncloneable',
			'Value cannot be cloned with `$state.snapshot` — the original value was returned'
		);
		return;
	}
	const shown = paths.slice(0, paths.length > 10 ? 7 : 10);
	let properties = shown.map((path) => `- <value>${path}`).join('\n');
	if (paths.length > shown.length) properties += `\n- ...and ${paths.length - shown.length} more`;
	warn(
		'state_snapshot_uncloneable',
		`The following properties cannot be cloned with \`$state.snapshot\` — the return value contains the originals:\n\n${properties}`,
		{ properties }
	);
}

export function snapshot<T>(value: T, silent = false): T {
	if (!DEV || silent) return clone(value, new Map(), '', null) as T;
	const paths: string[] = [];
	const copy = clone(value, new Map(), '', paths) as T;
	if (paths.length > 0) uncloneable(paths);
	return copy;
}
