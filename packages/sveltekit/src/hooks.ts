import type { sequence as kitSequence } from '@vigla/kit/hooks';
import { sequencer } from '@vigla/kit/internal/identity';
import { identity } from './identity.ts';

export * from '@vigla/kit/hooks';

export const sequence: typeof kitSequence = sequencer(identity);
