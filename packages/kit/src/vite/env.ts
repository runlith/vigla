import path from 'node:path';
import { uneval } from 'devalue';
import { createServer, isRunnableDevEnvironment, loadEnv } from 'vite';
import { validate, handleIssues, type EnvironmentIssues } from '../shared/env.ts';
import type { ValidatedConfig } from '../types/builder.ts';
import type { EnvVarConfig } from '../types/env.ts';
import { ids } from './ids.ts';
import * as e from './messages.ts';
import { configAliases, posix, resolveEntry } from './paths.ts';

export interface Environment {
	variables: Record<string, EnvVarConfig<any>>;
	values: Record<string, string>;
	validated: Record<string, unknown>;
	dependencies: Set<string>;
	file: string | null;
}

const reserved = new Set(
	'arguments await break case catch class const continue debugger default delete do else enum eval export extends false finally for function if implements import in instanceof interface let new null package private protected public return static super switch this throw true try typeof var void while with yield'.split(
		' '
	)
);

export async function loadEnvironment(
	config: ValidatedConfig,
	root: string,
	mode: string
): Promise<Environment> {
	const file = resolveEntry(path.join(config.files.src, 'env'), config.moduleExtensions);
	const result: Environment = {
		variables: {},
		values: loadEnv(mode, config.env.dir, ''),
		validated: {},
		dependencies: new Set(),
		file
	};
	if (!file) return result;
	const server = await createServer({
		root,
		configFile: false,
		logLevel: 'silent',
		server: { middlewareMode: true, watch: null },
		resolve: { alias: configAliases(config, root) },
		ssr: { noExternal: ['@sveltejs/kit', '@vigla/kit'] },
		plugins: [
			{
				name: 'kit:env-discovery',
				enforce: 'pre',
				resolveId(id, importer) {
					if (id === '$app/env') return '\0kit:env-discovery';
					if (/^\$app\/env\/(private|public)$/.test(id))
						e.env_circular_import({ type: id.split('/').at(-1)!, importer });
					if (id.startsWith('$app/') || id.startsWith('$env/')) e.env_app_import();
				},
				load(id) {
					if (id === '\0kit:env-discovery')
						return `export const browser = false; export const dev = ${mode !== 'production'}; export const building = true; export const prerendering = false; export const version = ${JSON.stringify(config.version.name)};`;
					result.dependencies.add(id);
				}
			}
		]
	});
	try {
		const ssr = server.environments.ssr;
		if (!ssr || !isRunnableDevEnvironment(ssr)) e.vite_ssr_environment_not_runnable();
		const module = await ssr.runner.import(file);
		if (
			!module.variables ||
			typeof module.variables !== 'object' ||
			Array.isArray(module.variables)
		)
			e.env_variables_missing({ file });
		result.variables = module.variables;
		const issues: EnvironmentIssues = {};
		for (const name of Object.keys(result.variables)) {
			if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) || reserved.has(name))
				e.env_invalid_variable_name({ name });
			result.validated[name] = validate(result.variables, result.values[name], name, issues);
		}
		handleIssues(issues);
		return result;
	} finally {
		await server.close();
	}
}

export function environmentConfig(environment: Environment, name: string): string {
	const lines = [
		`import { validate, handleIssues } from ${JSON.stringify(`${name}/internal/env`)};`,
		environment.file
			? `import { variables } from ${JSON.stringify(posix(environment.file))};`
			: 'const variables = {};',
		'const publicEnv = {}, privateEnv = {}, rendered = {}; export const environment = { public: publicEnv, private: privateEnv, rendered };'
	];
	const setters: string[] = [];
	Object.entries(environment.variables).forEach(([key, config], index) => {
		const binding = `value${index}`;
		lines.push(`let ${binding} = ${uneval(environment.validated[key])};`);
		const assignment = config.static
			? ''
			: `${binding} = validate(variables, values[${JSON.stringify(key)}], ${JSON.stringify(key)}, issues);`;
		setters.push(
			`${assignment}${config.public ? 'publicEnv' : 'privateEnv'}[${JSON.stringify(key)}] = ${binding};`
		);
		if (config.public && !config.static)
			setters.push(`rendered[${JSON.stringify(key)}] = ${binding};`);
	});
	lines.push(
		`export function setEnv(values) { const issues = {}; ${setters.join('\n')} handleIssues(issues); return { public: publicEnv, private: privateEnv, rendered }; }`,
		`setEnv(${uneval(Object.fromEntries(Object.keys(environment.variables).map((name) => [name, environment.values[name]])))});`
	);
	return lines.join('\n');
}

export function environmentModule(
	environment: Environment,
	visibility: 'public' | 'private',
	client: boolean
): string {
	const entries = Object.entries(environment.variables).filter(
		([, config]) => !!config.public === (visibility === 'public')
	);
	if (!entries.length) return 'export {};';
	if (!client)
		return `import { environment } from ${JSON.stringify(ids.env)};\n${entries.map(([name], index) => `const value${index} = environment.${visibility}[${JSON.stringify(name)}]; export { value${index} as ${name} };`).join('\n')}`;
	return entries
		.map(
			([name], index) =>
				`const value${index} = ${uneval(environment.validated[name])}; export { value${index} as ${name} };`
		)
		.join('\n');
}

export function workerEnvironment(
	environment: Environment,
	config: ValidatedConfig,
	name: string
): string {
	const values = Object.fromEntries(
		Object.entries(environment.variables)
			.filter(([, variable]) => variable.public)
			.map(([key]) => [key, environment.validated[key]])
	);
	return `import { init } from ${JSON.stringify(`${name}/internal/payload`)}; init({ base: location.pathname.split('/').slice(0, -1).join('/'), app_dir: ${JSON.stringify(config.appDir)}, hash: ${config.router.type === 'hash'}, version: ${JSON.stringify(config.version.name)}, env: ${uneval(values)} });`;
}

export function legacyEnvironment(
	visibility: 'public' | 'private',
	dynamic: boolean,
	name: string,
	dev: boolean
): string {
	const target = visibility === 'public' ? ids.publicEnv : ids.privateEnv;
	const exports = dynamic
		? `import * as env from ${JSON.stringify(target)}; export { env };`
		: `export * from ${JSON.stringify(target)};`;
	return `${exports}\n${dev ? `import { env_module_deprecated } from ${JSON.stringify(`${name}/internal/env`)}; env_module_deprecated({ module: '$env/${dynamic ? 'dynamic' : 'static'}/${visibility}', replacement: '$app/env/${visibility}' });` : ''}`;
}
