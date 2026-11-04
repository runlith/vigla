import type { defineParams as kitDefineParams } from '@vigla/kit/params';
import { paramsDefiner } from '@vigla/kit/internal/identity';
import { identity } from './identity.ts';

export * from '@vigla/kit/params';

export const defineParams: typeof kitDefineParams = paramsDefiner(identity);
