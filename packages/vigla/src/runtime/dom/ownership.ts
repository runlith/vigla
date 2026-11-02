import { DEV } from 'esm-env';
import { warn } from '../../shared/diagnostics.ts';
import { original } from '../reactivity/proxy.ts';
import { callerFile, componentFile } from './meta.ts';
import { boundProp } from './props.ts';

export interface Ownership {
	mutation<T>(
		prop: string,
		path: readonly PropertyKey[],
		result: T,
		line: number,
		column: number
	): T;
	binding(key: string, component: object, value: () => unknown): void;
}

export function ownership(props: Record<PropertyKey, unknown>, file: string): Ownership {
	const parent = callerFile();
	return {
		mutation(prop, path, result, line, column) {
			const name = path[0] as string;
			if (!DEV || parent === null || boundProp(props, name)) return result;
			let value: unknown = props;
			for (let index = 0; index < path.length - 1; index++) {
				value = (value as Record<PropertyKey, unknown>)[path[index] as PropertyKey];
				if (original(value) === value) return result;
			}
			warn(
				'ownership_invalid_mutation',
				`Mutating unbound props (\`${name}\`, at ${file}:${line}:${column}) is strongly discouraged. Consider using \`bind:${prop}={...}\` in ${parent} (or using a callback) instead`
			);
			return result;
		},
		binding(key, component, value) {
			if (!DEV || parent === null || boundProp(props, key)) return;
			const current = value();
			if (original(current) === current) return;
			warn(
				'ownership_invalid_binding',
				`${file} passed property \`${key}\` to ${componentFile(component)} with \`bind:\`, but its parent component ${parent} did not declare \`${key}\` as a binding. Consider creating a binding between ${parent} and ${file} (e.g. \`bind:${key}={...}\` instead of \`${key}={...}\`)`
			);
		}
	};
}
