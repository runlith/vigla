import type { sequence as kitSequence } from '@vigla/kit/hooks';
import { sequencer } from '@vigla/kit/internal/identity';
import { throwDiagnostic } from './history/diagnostics.ts';
import { identity } from './identity.ts';

export * from '@vigla/kit/hooks';

export const sequence: typeof kitSequence = sequencer(identity);

export function defineEnvVars(): never {
	throwDiagnostic(
		'define_env_vars_moved',
		'`defineEnvVars` has moved — import it from `@sveltejs/kit/env` instead',
		defineEnvVars
	);
}
