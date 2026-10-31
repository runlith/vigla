import { DEV } from 'esm-env';
import { service_worker_module_outside_worker } from '../../../shared/errors.ts';

export const self = globalThis.self;
if (DEV && (typeof document !== 'undefined' || typeof self === 'undefined'))
	service_worker_module_outside_worker();
