import { setReporter } from 'vigla/internal/client';
import { reporter } from '../report.ts';

setReporter(reporter);

export * from 'vigla/internal/client';
export { assignmentTarget, search } from '../proxy.ts';
export { pre as user_pre_effect, userEffect as user_effect } from 'vigla/internal/client';
