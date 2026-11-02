import { mutationTarget, original } from 'vigla/internal/client';
import { untrack } from 'vigla/internal/index-client';
import { reporter } from './report.ts';

type Search = 'includes' | 'indexOf' | 'lastIndexOf';
type Properties = Record<PropertyKey, unknown>;

const searches = {
	includes: Array.prototype.includes,
	indexOf: Array.prototype.indexOf,
	lastIndexOf: Array.prototype.lastIndexOf
};

function identity(value: unknown): unknown {
	try {
		return original(value);
	} catch {
		return value;
	}
}

export function assignmentTarget(receiver: unknown, key: PropertyKey, location: string) {
	const object = receiver as Properties;
	let property: PropertyKey | undefined;
	const reference = {
		[Symbol.toPrimitive]() {
			property = Reflect.ownKeys({ [key]: null })[0]!;
			return property;
		}
	} as unknown as PropertyKey;
	return mutationTarget(object, reference, (value) => {
		if (value !== null && typeof value === 'object') {
			const current = untrack(() => object[property!]);
			if (current !== value && identity(current) !== current) {
				reporter.warn({
					code: 'assignment_value_stale',
					message: `Assignment to \`${String(property)}\` property (${location}) will evaluate to the right-hand side, not the value of \`${String(property)}\` following the assignment. This may result in unexpected behaviour.`,
					values: {},
					dev: true
				});
			}
		}
	});
}

export function search(receiver: unknown, key: Search) {
	const object = receiver as Properties;
	const method = object[key] as (...args: unknown[]) => unknown;
	return (...args: unknown[]): unknown => {
		const intrinsic = method === searches[key];
		let from: number | undefined;
		const passed = [...args];
		if (intrinsic && key !== 'includes' && args.length > 1 && args[1] != null) {
			passed[1] = {
				[Symbol.toPrimitive]() {
					return (from = +(args[1] as number));
				}
			};
		}
		const result = Reflect.apply(method, receiver, passed);
		if (intrinsic && (key === 'includes' ? result === false : result === -1)) {
			untrack(() => {
				const length = object.length as number;
				const end = Math.min(key === 'lastIndexOf' ? (from ?? length - 1) + 1 : length, length);
				const start = key === 'indexOf' ? Math.max(from ?? 0, 0) : 0;
				for (let index = start; index < end; index++) {
					const value = object[index];
					if (value !== args[0] && identity(value) === args[0]) {
						reporter.warn({
							code: 'state_proxy_equality_mismatch',
							message: `Reactive \`$state(...)\` proxies and the values they proxy have different identities. Because of this, comparisons with \`array.${key}(...)\` will produce unexpected results`,
							values: {},
							dev: true
						});
						break;
					}
				}
			});
		}
		return result;
	};
}
