import type { Environment, ServerOptions } from '../types/internal/server.ts';
import { findRequest } from './scope.ts';

export let version = '';
export let building = false;
export let prerendering = false;
let configured: Environment = { public: {}, private: {}, rendered: {} };

export function configureEnvironment(options: ServerOptions, environment: Environment): void {
	version = options.version.name;
	building = options.building;
	prerendering = options.prerendering;
	configured = environment;
}

function variables(kind: 'public' | 'private'): Record<string, unknown> {
	return new Proxy(
		{},
		{
			get(_target, key) {
				return Reflect.get((findRequest()?.environment ?? configured)[kind], key);
			},
			has(_target, key) {
				return Reflect.has((findRequest()?.environment ?? configured)[kind], key);
			},
			ownKeys() {
				return Reflect.ownKeys((findRequest()?.environment ?? configured)[kind]);
			},
			getOwnPropertyDescriptor(_target, key) {
				const value = Object.getOwnPropertyDescriptor(
					(findRequest()?.environment ?? configured)[kind],
					key
				);
				return value ? { ...value, configurable: true } : undefined;
			}
		}
	);
}

export const publicEnv = variables('public');
export const privateEnv = variables('private');
