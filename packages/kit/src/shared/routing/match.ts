import type { ParamMatcher, ParamValue } from '../../types/params.ts';
import type { RouteParam, RoutePattern } from '../../types/internal/routes.ts';
import * as errors from '../errors.ts';

export function exec(
	match: RegExpMatchArray,
	params: readonly RouteParam[],
	matchers: Record<string, ParamMatcher>
): Record<string, ParamValue> | undefined {
	const captures = match.slice(1);
	const result: Record<string, ParamValue> = {};
	let skipped = 0;
	for (const [index, param] of params.entries()) {
		let capture = captures[index - skipped];
		if (param.rest && param.chained && skipped > 0) {
			capture = captures
				.slice(index - skipped, index + 1)
				.filter(Boolean)
				.join('/');
			skipped = 0;
		}
		if (capture === undefined) {
			if (!param.rest) continue;
			capture = '';
		}
		const decoded = decodeURIComponent(capture);
		if (param.matcher) {
			const validation = matchers[param.matcher]!['~standard'].validate(decoded);
			if (validation instanceof Promise) errors.param_matcher_async();
			if (validation.issues) {
				if (!param.optional || !param.chained) return undefined;
				skipped++;
				continue;
			}
			const value: unknown = validation.value;
			if (
				typeof value !== 'string' &&
				typeof value !== 'number' &&
				typeof value !== 'boolean' &&
				typeof value !== 'bigint'
			)
				errors.param_matcher_result_invalid();
			result[param.name] = value;
		} else {
			result[param.name] = decoded;
		}
		const next = params[index + 1];
		if (next?.optional && !next.rest && captures[index + 1] && param.chained) skipped = 0;
		if (
			!next &&
			!captures[index + 1] &&
			Object.keys(result).length === captures.filter((value) => value !== undefined).length
		)
			skipped = 0;
	}
	return skipped ? undefined : result;
}

export interface RouteMatch<T> {
	route: T;
	params: Record<string, ParamValue>;
}

export function findRoute<T extends RoutePattern>(
	path: string,
	routes: readonly T[],
	matchers: Record<string, ParamMatcher>
): RouteMatch<T> | null {
	for (const route of routes) {
		const match = route.pattern.exec(path);
		if (!match) continue;
		const params = exec(match, route.params, matchers);
		if (params) return { route, params };
	}
	return null;
}
