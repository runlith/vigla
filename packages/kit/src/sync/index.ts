import { resolve } from 'node:path';
import type { ValidatedConfig } from '../types/builder.ts';
import type { EnvVarConfig } from '../types/env.ts';
import type { RouteTree } from '../types/internal/routes.ts';
import { writeAppTypes, writeEnvironment } from './app-types.ts';
import { discover } from './discover.ts';
import { installation } from './package.ts';
import { writeRouteTypes } from './route-types.ts';
import { writeTsconfig } from './typescript.ts';

export { discover } from './discover.ts';
export { installation, type Installation } from './package.ts';
export { analyseOptions } from './options.ts';
export { loadEnvironment, validateEnvironment, isRunnable, type Environment } from './env.ts';
export { resolveEntry } from './files.ts';
export { vite_ssr_environment_not_runnable } from './errors.ts';

export interface Sync {
	initial(mode: string): Promise<RouteTree>;
	update(file: string): Promise<RouteTree>;
	resync(): Promise<RouteTree>;
	writeEnvironment(entry: string | null, variables: Record<string, EnvVarConfig<any>> | null): void;
}

export function createSync(config: ValidatedConfig, root: string): Sync {
	const { name } = installation(root);
	let entry: string | null = null;
	let variables: Record<string, EnvVarConfig<any>> | null = null;
	const sync = async (): Promise<RouteTree> => {
		const tree = discover(config, root);
		writeTsconfig(config, root);
		writeAppTypes(config, tree, root, name);
		writeRouteTypes(config, tree, root, name);
		writeEnvironment(root, name, entry, variables);
		return tree;
	};
	return {
		initial: (_mode) => sync(),
		update: (_file) => sync(),
		resync: sync,
		writeEnvironment(file, declarations) {
			entry = file === null ? null : resolve(root, file);
			variables = declarations;
			writeEnvironment(root, name, entry, variables);
		}
	};
}
