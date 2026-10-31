import type { ParamValue } from '../../types/params.ts';
import type { RouteParam, RoutePattern } from '../../types/internal/routes.ts';
import * as errors from '../errors.ts';

export interface RouteToken {
	text: string;
	param?: RouteParam;
}

const parameter = /^(\[)?(\.\.\.)?([\w-]+)(?:=([\w-]+))?(\])?$/;
const tokens = /\[([ux])\+([^\]]+)\]|\[(\[)?(\.\.\.)?([\w-]+)(?:=([\w-]+))?\]\]?/g;

export function routeSegments(id: string): string[] {
	return id.split('/').filter((segment) => segment !== '' && !/^\([^)]+\)$/.test(segment));
}

export function decodeEscape(code: string): string {
	return String.fromCodePoint(...code.split('-').map((part) => Number.parseInt(part, 16)));
}

export function encodePathChars(value: string): string {
	return value.replace(/[%/?#]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

export function invalidParam(id: string): string | undefined {
	for (const segment of routeSegments(id)) {
		const pieces = segment.split(/\[(.+?)\](?!\])/);
		for (let i = 1; i < pieces.length; i += 2) {
			const content = pieces[i]!;
			if (!/^[ux]\+/.test(content) && !parameter.test(content)) return content;
		}
	}
	return undefined;
}

export function segmentTokens(segment: string): RouteToken[] {
	const output: RouteToken[] = [];
	let cursor = 0;
	let literal = '';
	for (const match of segment.matchAll(tokens)) {
		literal += segment.slice(cursor, match.index);
		if (match[1]) {
			literal += decodeEscape(match[2]!);
		} else {
			output.push(
				{ text: literal },
				{
					text: match[0],
					param: {
						name: match[5]!,
						matcher: match[6],
						optional: !!match[3],
						rest: !!match[4],
						chained: !!match[4] && match.index === 0
					}
				}
			);
			literal = '';
		}
		cursor = match.index + match[0].length;
	}
	output.push({ text: literal + segment.slice(cursor) });
	return output;
}

function literalPattern(text: string): string {
	return text
		.normalize()
		.split(/([%/?#])/)
		.map((part) => {
			if (part === '/') return '%2[Ff]';
			if (part === '?') return '%3[Ff]';
			if (part === '%') return '%25';
			if (part === '#') return '%23';
			return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		})
		.join('');
}

export function parseRoute(id: string): RoutePattern {
	const params: RouteParam[] = [];
	const segments = routeSegments(id);
	if (!segments.length) return { pattern: /^\/$/, params };
	const source = segments
		.map((segment) => {
			const pieces = segmentTokens(segment);
			const dynamic = pieces.filter((piece) => piece.param);
			const whole = dynamic.length === 1 && dynamic[0]!.text === segment;
			if (whole && (dynamic[0]!.param!.rest || dynamic[0]!.param!.optional)) {
				const param = { ...dynamic[0]!.param!, chained: true };
				params.push(param);
				return param.rest ? '(?:/([^]*))?' : '(?:/([^/]+))?';
			}
			return (
				'/' +
				pieces
					.map(({ text, param }) => {
						if (!param) return literalPattern(text);
						params.push(param);
						return param.rest ? '([^]*?)' : param.optional ? '([^/]*)?' : '([^/]+?)';
					})
					.join('')
			);
		})
		.join('');
	return { pattern: new RegExp(`^${source}/?$`), params };
}

export function resolveRoute(id: string, params: Record<string, ParamValue | undefined>): string {
	const segments = routeSegments(id)
		.map((segment) =>
			segment.replace(
				tokens,
				(
					_all,
					kind: string | undefined,
					code: string,
					optional: string | undefined,
					rest: string | undefined,
					name: string
				) => {
					if (kind) return encodePathChars(decodeEscape(code));
					const value = params[name];
					if (value === undefined || value === '') {
						if (optional || (rest && value !== undefined)) return '';
						errors.route_param_missing({ id, name });
					}
					if (typeof value === 'string') {
						if (value.startsWith('/') || value.endsWith('/'))
							errors.route_param_slash({ id, name });
						return value;
					}
					if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint')
						return String(value);
					return errors.route_param_value_invalid({ id, name });
				}
			)
		)
		.filter(Boolean);
	return '/' + segments.join('/') + (id !== '/' && id.endsWith('/') ? '/' : '');
}
