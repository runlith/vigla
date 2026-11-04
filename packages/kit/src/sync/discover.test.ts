import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';
import { resolveConfig, validateConfig } from '../config/index.ts';
import { discover } from './discover.ts';
import { diagnostics } from '../shared/diagnostics.ts';
import { own } from '../shared/identity.ts';

const d = diagnostics(own);

const roots: string[] = [];
function project(files: Record<string, string> = {}) {
	const root = mkdtempSync(join(tmpdir(), 'routes-'));
	roots.push(root);
	for (const [name, content] of Object.entries(files)) {
		const file = join(root, name);
		mkdirSync(dirname(file), { recursive: true });
		writeFileSync(file, content);
	}
	const config = resolveConfig(validateConfig({ extensions: ['.view'] }, d), root, d);
	return { root, config, tree: () => discover(config, root, d) };
}
afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

test('discovers deterministic shared node indexes, route branches, assets, hooks and params', () => {
	const app = project({
		'src/routes/+page.view': '',
		'src/routes/blog/+layout.view': '',
		'src/routes/blog/+layout.server.ts': 'export const ssr = false;',
		'src/routes/blog/[slug]/+page.view': '',
		'src/routes/blog/[slug]/+page.ts': 'export const csr = false;',
		'src/routes/blog.json/+server.ts': 'export const GET = () => new Response();',
		'src/hooks.server/index.ts': 'export {};',
		'src/params.ts': 'export const params = {};',
		'static/nested/file.txt': 'asset'
	});
	const tree = app.tree();
	expect(tree.nodes.slice(0, 2)).toEqual([
		{ depth: 0, parent: null, options: {} },
		{ depth: 0, parent: 0, options: {} }
	]);
	const blog = tree.routes.find((route) => route.id === '/blog/[slug]')!;
	expect(blog.page?.layouts).toEqual([0, 2]);
	expect(blog.page?.errors).toEqual([1, undefined]);
	expect(tree.nodes[blog.page!.leaf]!.options).toEqual({ ssr: false, csr: false });
	expect(tree.routes.filter((route) => route.page || route.endpoint).map(({ id }) => id)).toEqual([
		'/',
		'/blog.json',
		'/blog/[slug]'
	]);
	expect(tree.assets).toEqual([{ file: 'nested/file.txt', type: 'text/plain' }]);
	expect(tree.hooks.server).toBe('src/hooks.server/index.ts');
	expect(tree.params).toBe('src/params.ts');
	expect(app.tree()).toEqual(tree);
});

test('resets named layouts and aligns error-only levels without object cycles', () => {
	const app = project({
		'src/routes/+layout.ts': 'export const ssr = false;',
		'src/routes/(group)/+layout.view': '',
		'src/routes/(group)/nested/+error.view': '',
		'src/routes/(group)/nested/normal/+page.view': '',
		'src/routes/(group)/nested/reset/+page@.view': ''
	});
	const tree = app.tree();
	const normal = tree.routes.find((route) => route.id.endsWith('/normal'))!;
	const reset = tree.routes.find((route) => route.id.endsWith('/reset'))!;
	expect(normal.page?.layouts).toEqual([0, 2, undefined]);
	expect(normal.page?.errors).toEqual([1, undefined, 3]);
	expect(reset.page?.layouts).toEqual([0]);
	expect(tree.nodes[reset.leaf!]!.parent).toBe(0);
	expect(JSON.parse(JSON.stringify(tree)).routes.length).toBe(tree.routes.length);
});

test('omits hidden and auxiliary files but follows symlinked directories', () => {
	const app = project({
		'src/routes/_private/+page.view': '',
		'src/routes/.hidden/+server.ts': '',
		'src/routes/.well-known/policy.txt/+server.ts': '',
		'src/routes/+page.view.swp': '',
		'src/routes/+page.test.ts': '',
		'src/routes/+page.view.d.ts': '',
		'src/routes/+page.ts': 'export const load = () => ({});',
		'outside/+page.view': ''
	});
	symlinkSync(join(app.root, 'outside'), join(app.config.files.routes, 'linked'), 'dir');
	const tree = app.tree();
	expect(tree.routes.filter((route) => route.page || route.endpoint).map(({ id }) => id)).toEqual([
		'/',
		'/.well-known/policy.txt',
		'/linked'
	]);
	expect(tree.nodes.find((node) => node.universal)?.options).toEqual({ load: null });
});

test('preserves optional, rest, matched and escaped route patterns', () => {
	const tree = project({
		'src/routes/[[locale=lang]]/[...path]/+page.view': '',
		'src/routes/[x+23]/[u+1f600]/+server.ts': ''
	}).tree();
	const optional = tree.routes.find((route) => route.page)!;
	expect(optional.params).toEqual([
		{ name: 'locale', matcher: 'lang', optional: true, rest: false, chained: true },
		{ name: 'path', matcher: undefined, optional: false, rest: true, chained: true }
	]);
	expect(optional.pattern.test('/')).toBe(true);
	expect(tree.routes.find((route) => route.endpoint)?.pattern.test('/%23/😀')).toBe(true);
});

test.each([
	['[x+2F]', 'route_escape_uppercase'],
	['[x+z2]', 'route_escape_invalid'],
	['[x+222]', 'route_escape_hex_length'],
	['[u+123]', 'route_escape_unicode_length'],
	['[a][b]', 'route_params_adjacent'],
	['[param', 'route_unbalanced_brackets'],
	['hash#', 'route_hash_character'],
	['[...rest]/[[optional]]', 'route_optional_after_rest'],
	['[[...rest]]', 'route_optional_rest'],
	['[invalid.name]', 'route_param_invalid']
])('rejects invalid route %s', (directory, code) => {
	const app = project({ [`src/routes/${directory}/+page.view`]: '' });
	expect(app.tree).toThrow(code);
});

test.each([
	[{ 'src/routes/a/+page.view': '', 'src/routes/a/+page@.view': '' }, 'route_duplicate_files'],
	[{ 'src/routes/a/+page.js': '', 'src/routes/a/+page.ts': '' }, 'route_duplicate_files'],
	[{ 'src/routes/(a)/x/+page.view': '', 'src/routes/(b)/x/+server.ts': '' }, 'route_conflict'],
	[{ 'src/routes/[a]/+page.view': '', 'src/routes/[b]/+page.view': '' }, 'route_conflict'],
	[{ 'src/routes/x/[[a]]/z/+page.view': '', 'src/routes/x/z/+page.view': '' }, 'route_conflict'],
	[{ 'src/routes/+page@missing.view': '' }, 'route_layout_segment_missing'],
	[{ 'src/routes/+page@.ts': '' }, 'route_named_layout_in_module'],
	[{ 'src/routes/+other.view': '' }, 'route_file_reserved'],
	[
		{
			'src/routes/+page.view': '',
			'src/routes/+page.ts': 'export const prerender = true;',
			'src/routes/+server.ts': ''
		},
		'route_prerender_page_and_endpoint'
	]
] as const)('diagnoses route model conflict %j', (files, code) => {
	expect(project(files).tree).toThrow(code);
});

test('diagnoses misspelled hook entries without changing the discovered hook path', () => {
	const app = project({ 'src/routes/+page.view': '', 'src/hook.server.ts': '' });
	const messages: string[] = [];
	const warning = vi
		.spyOn(console, 'warn')
		.mockImplementation((message) => messages.push(String(message)));
	try {
		expect(app.tree().hooks.server).toBeNull();
		expect(messages.join('\n')).toContain('file_name_misspelled');
		expect(messages.join('\n')).toContain('hooks.server.ts');
		expect(messages.join('\n')).toContain(join(app.root, 'src/hook.server.ts'));
	} finally {
		warning.mockRestore();
	}
});

test('rejects server files for hash routing', () => {
	const app = project({ 'src/routes/+server.ts': '' });
	app.config.router.type = 'hash';
	expect(app.tree).toThrow('route_server_file_hash_router');
});

test('keeps defaults when routes are absent and diagnoses an empty routes directory', () => {
	const app = project();
	expect(app.tree().nodes).toHaveLength(2);
	mkdirSync(app.config.files.routes, { recursive: true });
	expect(app.tree).toThrow('routes_not_found');
});
