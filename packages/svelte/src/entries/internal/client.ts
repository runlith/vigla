import { setReporter } from 'vigla/internal/client';
import { format } from '../../shared/format.ts';
import { reporter } from '../report.ts';

setReporter(reporter);
setReporter(reporter, format);

export * from 'vigla/internal/client';
export { assignmentTarget, search } from '../proxy.ts';
export {
	lapsingDerived as derived,
	pre as user_pre_effect,
	unowned as without_reactive_context,
	userEffect as user_effect
} from 'vigla/internal/client';
