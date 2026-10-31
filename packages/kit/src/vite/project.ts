import type { ResolvedConfig } from 'vite';
import type { Format } from 'vigla/compiler';
import type { Sync } from '../sync/index.ts';
import type { ValidatedConfig } from '../types/builder.ts';
import type { RouteTree } from '../types/internal/routes.ts';
import type { Environment } from './env.ts';

export interface Project {
	root: string;
	name: string;
	config: ValidatedConfig;
	vite: ResolvedConfig;
	api: typeof import('vite');
	sync: Sync;
	tree: RouteTree;
	environment: Environment;
	format?: Format;
	serviceWorker: string | null;
}
