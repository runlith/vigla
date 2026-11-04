import { decodeEscape, invalidParam, routeSegments } from '../shared/routing/index.ts';
import type { Route } from '../types/internal/routes.ts';
import type { SyncErrors } from './errors.ts';

export function validateRoute(id: string, e: SyncErrors): void {
	const literal = id.replace(
		/\[([ux])\+([^\]]+)\]/gi,
		(whole: string, kind: string, code: string) => {
			if (whole !== whole.toLowerCase()) e.route_escape_uppercase({ id });
			if (!/^[0-9a-f]+$/.test(code)) e.route_escape_invalid({ id });
			if (kind === 'x' && code.length !== 2) e.route_escape_hex_length({ id });
			if (kind === 'u' && (code.length < 4 || code.length > 6))
				e.route_escape_unicode_length({ id });
			return decodeEscape(code);
		}
	);
	if (literal.includes('][')) e.route_params_adjacent({ id });
	if ((id.match(/\[/g)?.length ?? 0) !== (id.match(/\]/g)?.length ?? 0))
		e.route_unbalanced_brackets({ id });
	if (id.includes('#')) e.route_hash_character({ id, suggestion: id.replaceAll('#', '[x+23]') });
	if (/\[\.\.\.[\w-]+(?:=[\w-]+)?\]\/\[\[/.test(id)) e.route_optional_after_rest({ id });
	if (id.includes('[[...')) e.route_optional_rest({ id });
	const param = invalidParam(id);
	if (param !== undefined) e.route_param_invalid({ id, param });
}

export function validateConflicts(routes: readonly Route[], e: SyncErrors): void {
	const seen = new Map<string, string>();
	for (const route of routes) {
		if (route.leaf === null && !route.endpoint) continue;
		const normalized = routeSegments(route.id)
			.join('/')
			.replace(/\[[ux]\+([0-9a-f]+)\]/g, (_, code: string) =>
				decodeEscape(code).replaceAll('/', '%2f')
			)
			.replace(
				/\[(?:(\[)|(\.\.\.))?([^\]=]+)(?:=([^\]]+))?\]\]?/g,
				(_, optional: string, rest: string, _name: string, matcher: string) =>
					`<${optional ? '?' : ''}${rest ?? ''}${matcher ? '=' + matcher : '*'}>`
			);
		let keys = [normalized];
		if (!/<\?.+?>$/.test(normalized)) {
			const pieces = normalized.split(/<\?(.+?)>/g);
			keys = [pieces[0]!];
			for (let index = 1; index < pieces.length; index += 2) {
				keys = keys.flatMap((prefix) => [
					prefix + pieces[index + 1]!,
					prefix + `<${pieces[index]!}>` + pieces[index + 1]!
				]);
			}
		}
		for (const value of keys) {
			const key = value.replace(/\/{2,}/g, '/').replace(/^\/|\/$/g, '');
			const first = seen.get(key);
			if (first !== undefined && first !== route.id) e.route_conflict({ first, second: route.id });
			seen.set(key, route.id);
		}
	}
}
