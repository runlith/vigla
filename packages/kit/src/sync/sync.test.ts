import { spawnSync } from 'node:child_process';
import {
	existsSync,
	mkdtempSync,
	mkdirSync,
	readFileSync,
	realpathSync,
	rmSync,
	statSync,
	symlinkSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';
import { resolveConfig, validateConfig } from '../config/index.ts';
import { createSync } from './index.ts';
import { diagnostics } from '../shared/diagnostics.ts';
import { own } from '../shared/identity.ts';

const d = diagnostics(own);

const roots: string[] = [];
const packageRoot = resolve(import.meta.dirname, '../..');
const checker = resolve(packageRoot, '../../node_modules/.bin/tsrs');
function project(files: Record<string, string>, alias = '@sveltejs/kit') {
	const root = realpathSync(mkdtempSync(join(tmpdir(), 'sync-')));
	roots.push(root);
	const put = (name: string, text: string): void => {
		const file = join(root, name);
		mkdirSync(dirname(file), { recursive: true });
		writeFileSync(file, text);
	};
	put('package.json', JSON.stringify({ type: 'module', dependencies: { [alias]: 'workspace:*' } }));
	for (const [name, text] of Object.entries(files)) put(name, text);
	mkdirSync(join(root, 'node_modules', dirname(alias)), { recursive: true });
	symlinkSync(packageRoot, join(root, 'node_modules', alias), 'dir');
	const config = resolveConfig(
		validateConfig({ extensions: ['.view'], outDir: 'generated' }, d),
		root,
		d
	);
	return {
		root,
		put,
		config,
		sync: createSync(config, root, d),
		read: (file: string) => readFileSync(join(root, file), 'utf8')
	};
}
afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

test('initial sync generates installed-name declarations and preserves unchanged output mtimes', async () => {
	const app = project({ 'src/routes/[slug]/+page.view': '', 'static/a.txt': 'a' });
	app.config.alias = { '@lib': 'src/lib', '@one/*': 'src/one/*', '@file': 'src/one.ts' };
	app.config.typescript.config = (value) => {
		value.compilerOptions.strict = true;
		return { ...value, compilerOptions: { ...value.compilerOptions, noUnusedLocals: true } };
	};
	const tree = await app.sync.initial('development');
	expect(tree.routes.find((route) => route.page)?.id).toBe('/[slug]');
	const path = join(app.root, 'node_modules/$app/tsconfig.json');
	const generated = JSON.parse(app.read('node_modules/$app/tsconfig.json'));
	expect(generated.compilerOptions.rootDirs).toEqual(['../..', '../../generated/types']);
	expect(generated.compilerOptions.types).toEqual(['$app/types']);
	expect(generated.compilerOptions.paths).toEqual({
		'@lib': ['../../src/lib'],
		'@lib/*': ['../../src/lib/*'],
		'@one/*': ['../../src/one/*'],
		'@file': ['../../src/one.ts']
	});
	expect(generated.compilerOptions.strict).toBe(true);
	expect(generated.compilerOptions.noUnusedLocals).toBe(true);
	expect(app.read('node_modules/$app/tsconfig/service-worker.json')).toContain('WebWorker');
	expect(app.read('node_modules/$app/types/index.d.ts')).toContain('import "@sveltejs/kit"');
	expect(app.read('generated/types/src/routes/[slug]/$types.d.ts')).toContain(
		'from "@sveltejs/kit"'
	);
	expect(app.read('node_modules/$app/types/non-ambient.d.ts')).toContain('AssetPath(): "a.txt"');
	const before = statSync(path).mtimeMs;
	await app.sync.resync();
	expect(statSync(path).mtimeMs).toBe(before);
});

test('updates inherited options and declarations after edits, creates and deletes', async () => {
	const app = project(
		{ 'src/routes/+layout.ts': 'export const ssr = false;', 'src/routes/a/+page.view': '' },
		'@vigla/kit'
	);
	await app.sync.initial('development');
	app.put('src/routes/+layout.ts', 'export const ssr = true;');
	let tree = await app.sync.update(join(app.root, 'src/routes/+layout.ts'));
	expect(tree.nodes[tree.routes.find((route) => route.id === '/a')!.leaf!]!.options).toEqual({
		ssr: true
	});
	app.put(
		'src/routes/b/+page.ts',
		"import type { PageLoad } from './$types'; export const load: PageLoad = () => ({ created: true });"
	);
	tree = await app.sync.update(join(app.root, 'src/routes/b/+page.ts'));
	expect(tree.routes.some((route) => route.id === '/b' && route.page)).toBe(true);
	expect(app.read('generated/types/src/routes/b/$types.d.ts')).toContain('from "@vigla/kit"');
	rmSync(join(app.root, 'src/routes/a'), { recursive: true });
	await app.sync.resync();
	expect(existsSync(join(app.root, 'generated/types/src/routes/a/$types.d.ts'))).toBe(false);
	rmSync(join(app.root, 'src/routes/b'), { recursive: true });
	await app.sync.resync();
	expect(existsSync(join(app.root, 'generated/types/src/routes/b/proxy+page.ts'))).toBe(false);
	expect(app.read('node_modules/$app/types/non-ambient.d.ts')).toContain('Path(): never;');
});

test('writes explicit environment schemas into only their declared visibility', async () => {
	const app = project({
		'src/routes/+page.view': '',
		'src/env.ts': `import { defineEnvVars } from '@sveltejs/kit/env'; export const variables = defineEnvVars({ PUBLIC: {public: true}, SECRET: {schema: (v: string | undefined) => Number(v)} });`
	});
	await app.sync.initial('development');
	app.sync.writeEnvironment(join(app.root, 'src/env.ts'), {
		PUBLIC: { public: true },
		SECRET: { schema: (value) => Number(value) }
	});
	const env = app.read('node_modules/$app/types/env.d.ts');
	expect(env.slice(env.indexOf("declare module '$app/env/public'"))).toContain(
		'export const PUBLIC: string'
	);
	expect(env.slice(env.indexOf("declare module '$app/env/public'"))).not.toContain(
		'export const SECRET'
	);
	expect(env).toContain('variables["SECRET"]');
	await app.sync.resync();
	expect(app.read('node_modules/$app/types/env.d.ts')).toBe(env);
});

test('validates compiler overrides as one diagnostic and identifies malformed JSONC', async () => {
	const app = project({
		'src/routes/+page.view': '',
		'src/service-worker.js': '',
		'tsconfig.json':
			'{ "extends": "$app/tsconfig", "compilerOptions": { "types": ["node"], "isolatedModules": false } }'
	});
	const messages: string[] = [];
	const warning = vi
		.spyOn(console, 'warn')
		.mockImplementation((message) => messages.push(String(message)));
	try {
		await app.sync.initial('development');
		expect(messages.join('\n')).toContain('tsconfig_invalid');
		expect(messages.join('\n')).toContain('"types"');
		expect(messages.join('\n')).toContain('"isolatedModules"');
		expect(messages.join('\n')).toContain(
			'"src/service-worker" should be added to the "exclude" array'
		);
		messages.length = 0;
		app.put(
			'tsconfig.json',
			JSON.stringify({
				extends: '$app/tsconfig',
				include: ['src'],
				exclude: ['src/service-worker.js']
			})
		);
		await app.sync.resync();
		expect(messages.join('\n')).not.toContain('"exclude" array');
		app.put('tsconfig.json', '{\n "extends": "$app/tsconfig",\n @\n}');
		await expect(app.sync.resync()).rejects.toThrow('tsconfig_parse_failed');
	} finally {
		warning.mockRestore();
	}
});

test('generated load, action, matcher, parent and props types retain inferred values', async () => {
	const app = project({
		'tsconfig.json': JSON.stringify({
			extends: '$app/tsconfig',
			compilerOptions: { strict: true },
			include: ['src', 'check.ts']
		}),
		'src/routes/+layout.ts': `import type { LayoutLoad } from './$types'; export const load: LayoutLoad = () => ({ root: 'root' });`,
		'src/routes/[id=integer]/+page.server.ts': `import type { PageServerLoad, Actions } from './$types'; export const load: PageServerLoad = ({ params }) => ({ id: params.id, secret: 'server' }); export const actions: Actions = { save: ({ params }) => ({ saved: params.id }) };`,
		'src/routes/[id=integer]/+page.ts': `import type { PageLoad } from './$types'; export const load: PageLoad = ({ data }) => ({ id: data.id, client: true as const });`,
		'src/params.ts': `import { defineParams } from '@sveltejs/kit/params'; export const params = defineParams({ integer: (value: string) => Number(value), word: (value: string) => value });`,
		'src/routes/[id=word]/+page.ts': `import type { PageLoad } from './$types'; export const load: PageLoad = ({ params }) => ({ id: params.id });`,
		'src/routes/js/+page.js': `/** @type {import('./$types').PageLoad} */ export const load = (event) => ({ size: event.url.pathname.length });`,
		'src/routes/js/+page.server.js': `/** @type {import('./$types').Actions} */ export const actions = { save: (event) => ({ saved: event.url.pathname.length }) };`,
		'src/routes/optional/[[slug]]/+page.ts': `function factory() { return { load: () => ({ optional: true }) }; } export const { load } = factory();`,
		'src/env.ts': `import { defineEnvVars } from '@sveltejs/kit/env'; export const variables = defineEnvVars({ COUNT: { public: true, schema: (v: string | undefined) => Number(v) } });`,
		'check.ts': `import type { PageData, PageProps, ActionData } from './generated/types/src/routes/[id=integer]/$types';
			declare const data: PageData; const id: number = data.id; const root: string = data.root; const client: true = data.client;
			declare const props: PageProps; const param: number = props.params.id;
			declare const action: NonNullable<ActionData>; const saved: number = action.saved;
			// @ts-expect-error
			const wrong: string = data.id;
			import type { PageData as JsData, ActionData as JsActions } from './generated/types/src/routes/js/$types';
			declare const js: JsData; const size: number = js.size;
			declare const jsAction: NonNullable<JsActions>; const jsSaved: number = jsAction.saved;
			// @ts-expect-error
			const wrongJs: string = js.size;
			import type { PageProps as OptionalProps } from './generated/types/src/routes/optional/[[slug]]/$types';
			declare const optional: OptionalProps; const slug: string | undefined = optional.params.slug;
			import type { LayoutProps } from './generated/types/src/routes/$types';
			declare const layout: LayoutProps; const layoutId: number | string | undefined = layout.params.id;
			// @ts-expect-error
			const wrongLayoutId: boolean = layout.params.id;
			import { COUNT } from '$app/env/public'; const count: number = COUNT;
			// @ts-expect-error
			const wrongCount: string = COUNT;
			void [id, root, client, param, saved, wrong, size, jsSaved, wrongJs, slug, layoutId, wrongLayoutId, count, wrongCount];`
	});
	await app.sync.initial('development');
	app.sync.writeEnvironment(join(app.root, 'src/env.ts'), {
		COUNT: { public: true, schema: (value) => Number(value) }
	});
	const result = spawnSync(checker, ['-p', app.root, '--noEmit'], { encoding: 'utf8' });
	expect(result.stdout + result.stderr).toBe('');
	expect(result.status).toBe(0);
}, 30_000);
