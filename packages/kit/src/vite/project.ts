import type { ResolvedConfig } from 'vite';
import type { Format } from 'vigla/compiler';
import type { Sync, Environment } from '../sync/index.ts';
import type { Diagnostics } from '../shared/diagnostics.ts';
import type { ValidatedConfig } from '../types/builder.ts';
import type { Identity } from '../types/identity.ts';
import type { RouteTree } from '../types/internal/routes.ts';
import type { BuildContext } from '../build/index.ts';
import type { RemoteIntegration } from './remote.ts';

export interface Project {
	identity: Identity;
	diagnostics: Diagnostics;
	root: string;
	name: string;
	global: string;
	remote: RemoteIntegration;
	build?: BuildContext;
	config: ValidatedConfig;
	vite: ResolvedConfig;
	api: typeof import('vite');
	sync: Sync;
	tree: RouteTree;
	environment: Environment;
	format?: Format;
	serviceWorker: string | null;
}
