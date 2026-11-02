import { uneval } from 'devalue';
import type { ValidatedConfig } from '../types/builder.ts';
import type { Environment } from '../sync/index.ts';
import { ids } from './ids.ts';
import { posix } from './paths.ts';

export function environmentConfig(environment: Environment, name: string, dev: boolean): string {
	const lines = [
		`import { validate, handleIssues } from ${JSON.stringify(`${name}/internal/env`)};`,
		'const publicEnv = {}, privateEnv = {}, rendered = {}; export const environment = { public: publicEnv, private: privateEnv, rendered }; let variables = {}; export let values = {};'
	];
	const setters: string[] = [];
	Object.entries(environment.variables).forEach(([key, config], index) => {
		const binding = `value${index}`;
		lines.push(
			`export let ${binding} = ${uneval(config.static || dev ? environment.validated[key] : undefined)}; ${config.public ? 'publicEnv' : 'privateEnv'}[${JSON.stringify(key)}] = ${binding};`
		);
		if (config.public && !config.static && dev)
			lines.push(`rendered[${JSON.stringify(key)}] = ${binding};`);
		if (!config.static)
			setters.push(
				`${binding} = validate(variables, values[${JSON.stringify(key)}], ${JSON.stringify(key)}, issues);`
			);
		setters.push(
			`${config.public ? 'publicEnv' : 'privateEnv'}[${JSON.stringify(key)}] = ${binding};`
		);
		if (config.public && !config.static)
			setters.push(`rendered[${JSON.stringify(key)}] = ${binding};`);
	});
	const variables = environment.file
		? `(await import(${JSON.stringify(posix(environment.file))})).variables`
		: '{}';
	lines.push(
		`export function updateEnv(next) { values = next; const issues = {}; ${setters.join('\n')} handleIssues(issues); return environment; }`,
		`export async function setEnv(next) { variables = ${variables}; return updateEnv(next); }`,
		'export { setEnv as set_env };'
	);
	return lines.join('\n');
}

export function environmentModule(
	environment: Environment,
	visibility: 'public' | 'private',
	client: boolean,
	dev: boolean
): string {
	const entries = Object.entries(environment.variables).filter(
		([, config]) => !!config.public === (visibility === 'public')
	);
	if (!entries.length) return 'export {};';
	if (!client)
		return `export { ${entries.map(([name]) => `value${Object.keys(environment.variables).indexOf(name)} as ${name}`).join(', ')} } from ${JSON.stringify(ids.env)};`;
	const runtime = !dev && entries.some(([, config]) => !config.static);
	return `${runtime ? `import { env } from '#env/dynamic/public';\n` : ''}${entries.map(([name, config], index) => `const value${index} = ${!dev && !config.static ? `env[${JSON.stringify(name)}]` : uneval(environment.validated[name])}; export { value${index} as ${name} };`).join('\n')}`;
}

export function workerEnvironment(
	environment: Environment,
	config: ValidatedConfig,
	name: string,
	dev: boolean
): string {
	const dynamic =
		!dev &&
		Object.values(environment.variables).some((variable) => variable.public && !variable.static);
	const values = Object.fromEntries(
		Object.entries(environment.variables)
			.filter(([, variable]) => variable.public)
			.map(([key]) => [key, environment.validated[key]])
	);
	return `import { init } from ${JSON.stringify(`${name}/internal/payload`)}; ${dynamic ? `import { env } from ${JSON.stringify(config.paths.base + '/' + config.appDir + '/env.js')};` : ''} init({ base: location.pathname.split('/').slice(0, -1).join('/'), app_dir: ${JSON.stringify(config.appDir)}, hash: ${config.router.type === 'hash'}, version: ${JSON.stringify(config.version.name)}, env: ${
		dynamic
			? `Object.assign(${uneval(
					Object.fromEntries(
						Object.entries(environment.variables)
							.filter(([, variable]) => variable.public && variable.static)
							.map(([key]) => [key, environment.validated[key]])
					)
				)}, env)`
			: uneval(values)
	} });`;
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
