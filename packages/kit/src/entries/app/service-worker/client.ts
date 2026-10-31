import { DEV } from 'esm-env';
import { service_worker_module_outside_worker } from '../../../shared/errors.ts';

export const self = globalThis.self;
const scope: unknown = Reflect.get(globalThis, 'ServiceWorkerGlobalScope');
if (DEV && (typeof scope !== 'function' || !(self instanceof scope)))
	service_worker_module_outside_worker();
