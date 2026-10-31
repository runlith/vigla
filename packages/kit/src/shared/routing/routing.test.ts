import { describe, expect, test } from 'vitest';
import type { ParamMatcher, ParamValue } from '../../types/params.ts';
import { exec, findRoute, invalidParam, parseRoute, resolveRoute, sortRoutes } from './index.ts';

const accept: ParamMatcher = {
	'~standard': { version: 1, vendor: 'test', validate: (value) => ({ value }) }
};
const reject: ParamMatcher = {
	'~standard': {
		version: 1,
		vendor: 'test',
		validate: () => ({ issues: [{ message: 'rejected' }] })
	}
};
const integer: ParamMatcher = {
	'~standard': {
		version: 1,
		vendor: 'test',
		validate: (value) =>
			typeof value === 'string' && /^\d+$/.test(value)
				? { value: Number(value) }
				: { issues: [{ message: 'integer' }] }
	}
};
const matchers = { accept, reject, integer };

function route(id: string) {
	return { id, ...parseRoute(id) };
}

describe('route matching consumed by both runtimes', () => {
	test.each([
		['/(group)', '/', {}],
		['/(group)/[slug]', '/hello%20world', { slug: 'hello world' }],
		['/blog/[[slug]]/sub[[param]]', '/blog/sub', {}],
		['/blog/[[slug]]/sub[[param]]', '/blog/slug/subparam', { slug: 'slug', param: 'param' }],
		['/[[slug]]/[...rest]', '/', { rest: '' }],
		['/[[slug]]/[...rest]', '/slug/rest/sub', { slug: 'slug', rest: 'rest/sub' }],
		['/[...rest]/path', '/rest/path', { rest: 'rest' }],
		['/[[a=reject]]/[[b=reject]]/[...rest]', '/a/b/c', { rest: 'a/b/c' }],
		['/[[a=reject]]/[b]/[...rest]/end', '/a/b/c/end', { b: 'a', rest: 'b/c' }],
		[
			'/[[a=reject]]/[[b=accept]]/[[c=reject]]/[...rest].json',
			'/a/b/c.json',
			{ b: 'a', rest: 'b/c' }
		],
		['/[[a=reject]]/[[b=accept]]/c', '/a/b/c', undefined],
		['/[slug]/[[lang=reject]]/[[page=accept]]', '/a/2', { slug: 'a', page: '2' }],
		['/[...a=reject]/[b]', '/foo', undefined],
		['/[...a=accept]/[b]/[c]', '/foo/bar', { a: '', b: 'foo', c: 'bar' }],
		['/[...rest]', '/\n', { rest: '\n' }],
		['/[id=integer]', '/42', { id: 42 }],
		['/[id=integer]', '/abc', undefined],
		['/[x+2f]/[x+3f]/[x+23]/[x+25]/[u+1f600]', '/%2f/%3F/%23/%25/😀', {}],
		['/[x+5b]/[x+5d]', '/[/]', {}]
	])('%s matches %s', (id, path, expected) => {
		const { pattern, params } = parseRoute(id);
		const match = pattern.exec(path);
		expect(match).not.toBeNull();
		expect(exec(match!, params, matchers)).toEqual(expected);
	});

	test('falls through a rejected matcher and returns the first successful route', () => {
		const routes = [route('/[id=integer]'), route('/[slug]'), route('/[...rest]')];
		expect(findRoute('/42', routes, matchers)?.params).toEqual({ id: 42 });
		expect(findRoute('/abc', routes, matchers)?.route.id).toBe('/[slug]');
		expect(findRoute('/a/b', [route('/a')], {})).toBeNull();
	});

	test('rejects asynchronous or non-scalar matcher results', () => {
		const make = (validate: (value: unknown) => any): ParamMatcher => ({
			'~standard': { version: 1, vendor: 'test', validate }
		});
		const routes = [route('/[id=matcher]')];
		expect(() => findRoute('/a', routes, { matcher: make(async () => ({ value: 'a' })) })).toThrow(
			'param_matcher_async'
		);
		expect(() => findRoute('/a', routes, { matcher: make(() => ({ value: {} })) })).toThrow(
			'param_matcher_result_invalid'
		);
	});

	test('reports malformed param names before constructing routes', () => {
		expect(invalidParam('/[slug=my-matcher]')).toBeUndefined();
		expect(invalidParam('/(group)/[a]/[b c]')).toBe('b c');
		expect(invalidParam('/a[slug=ma.tcher]b')).toBe('slug=ma.tcher');
	});
});

describe('route resolution consumed by app paths', () => {
	test.each([
		['/blog/[one]/[two]-[three]/', { one: 'a', two: 'b', three: 'c' }, '/blog/a/b-c/'],
		['/(group)/[one=matcher]/[...two]', { one: 42, two: 'a/b' }, '/42/a/b'],
		['/flags/[flag]/[[optional]]', { flag: false }, '/flags/false'],
		['/rest/[...path]/', { path: '' }, '/rest/'],
		['/[x+2e]well-known/[u+1f600]/[x+2f]/[slug]', { slug: '[x+2f]' }, '/.well-known/😀/%2F/[x+2f]']
	])('%s resolves with params', (id, params, expected) => {
		expect(resolveRoute(id, params as Record<string, ParamValue>)).toBe(expected);
	});

	test.each([
		[{}, 'route_param_missing'],
		[{ slug: '/a' }, 'route_param_slash'],
		[{ slug: 'a/' }, 'route_param_slash'],
		[{ slug: {} }, 'route_param_value_invalid']
	])('rejects invalid substitution %j', (params, code) => {
		expect(() => resolveRoute('/[slug]', params as Record<string, ParamValue>)).toThrow(code);
	});
});

test('route precedence preserves static, matched, required, optional and rest order', () => {
	const ids = [
		'/[...rest]',
		'/[[optional]]',
		'/[required]',
		'/[matched=integer]',
		'/foo',
		'/foobar'
	];
	expect(sortRoutes(ids.map(route)).map(({ id }) => id)).toEqual([
		'/foobar',
		'/foo',
		'/[matched=integer]',
		'/[required]',
		'/[[optional]]',
		'/[...rest]'
	]);
	const precedence = [
		'/',
		'/a',
		'/b',
		'/b/[required]',
		'/c',
		'/c/bar',
		'/c/b[x].json',
		'/c/b[x]',
		'/c/foo',
		'/d/e',
		'/d/e[...rest]',
		'/e/f',
		'/e/[...rest]/f',
		'/f/static[...rest]',
		'/f/[...rest]static',
		'/g/[[optional]]/static',
		'/g/[required]',
		'/g/[...rest]/[required]',
		'/h/a/b',
		'/h/a/[required]/b',
		'/h/a/[...rest]/b',
		'/x/[...rest]',
		'/[...rest]/x',
		'/[...rest]/x/[...deep_rest]/y',
		'/[...rest]/x/[...deep_rest]',
		'/[required=matcher]',
		'/[required]',
		'/[...rest]'
	];
	expect(sortRoutes([...precedence].reverse().map(route)).map(({ id }) => id)).toEqual(precedence);
	const encoded = ['/[u+1f600]', '/[x+22]', '/[x+23]', '/[x+3f]', '/[x+5b]', '/[x+5d]'];
	expect(sortRoutes(encoded.map(route)).map(({ id }) => id)).toEqual([...encoded].reverse());
	const suffixes = ['/[required]/[id]', '/[...rest]', '/[...rest]/x', '/[required]/x'];
	expect(sortRoutes(suffixes.map(route)).map(({ id }) => id)).toEqual([
		'/[required]/x',
		'/[...rest]/x',
		'/[required]/[id]',
		'/[...rest]'
	]);
});
