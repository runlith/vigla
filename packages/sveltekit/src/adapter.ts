import type { applyReroute as kitApplyReroute } from '@vigla/kit/adapter';
import { rerouter } from '@vigla/kit/internal/identity';
import { identity } from './identity.ts';

export * from '@vigla/kit/adapter';

export const applyReroute: typeof kitApplyReroute = rerouter(identity);
