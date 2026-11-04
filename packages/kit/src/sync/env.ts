import path from 'node:path';
import type { DevEnvironment, RunnableDevEnvironment } from 'vite';
import { configAliases } from '../config/file.ts';
import { validate, handleIssues, type EnvironmentIssues } from '../shared/env.ts';
import type { ValidatedConfig } from '../types/builder.ts';
import type { EnvVarConfig } from '../types/env.ts';
import { resolveEntry } from './files.ts';
import { installation } from './package.ts';
import * as e from './errors.ts';

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

export function isRunnable(
	environment: DevEnvironment | undefined
): environment is RunnableDevEnvironment {
	if (!environment || !('runner' in environment)) return false;
	const runner = environment.runner as RunnableDevEnvironment['runner'];
	return !!runner && typeof runner.import === 'function';
}

export function validateEnvironment(environment: Environment): void {
	const issues: EnvironmentIssues = {};
	for (const name of Object.keys(environment.variables)) {
		environment.validated[name] = validate(
			environment.variables,
			environment.values[name],
			name,
			issues
		);
	}
	handleIssues(issues);
}

export async function loadEnvironment(
	config: ValidatedConfig,
	root: string,
	mode: string,
	vite: typeof import('vite')
): Promise<Environment> {
	const file = resolveEntry(path.join(config.files.src, 'env'), config.moduleExtensions);
	const result: Environment = {
		variables: {},
		values: vite.loadEnv(mode, config.env.dir, ''),
		validated: {},
		dependencies: new Set(),
		file
	};
	if (!file) return result;
	const server = await vite.createServer({
		root,
		configFile: false,
		logLevel: 'silent',
		mode,
		server: { middlewareMode: true, watch: null },
		resolve: { alias: configAliases(config, root) },
		ssr: { noExternal: [installation(root).name, '@vigla/kit'] },
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
						return `export const browser = false; export const dev = ${mode === 'development'}; export const building = true; export const prerendering = false; export const version = ${JSON.stringify(config.version.name)};`;
					result.dependencies.add(id);
				}
			}
		]
	});
	try {
		const ssr = server.environments.ssr;
		if (!isRunnable(ssr)) e.vite_ssr_environment_not_runnable();
		const module = await ssr.runner.import(file);
		if (
			!module.variables ||
			typeof module.variables !== 'object' ||
			Array.isArray(module.variables)
		)
			e.env_variables_missing({ file });
		result.variables = module.variables;
		for (const name of Object.keys(result.variables)) {
			if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) || reserved.has(name))
				e.env_invalid_variable_name({ name });
		}
		return result;
	} finally {
		await server.close();
	}
}
