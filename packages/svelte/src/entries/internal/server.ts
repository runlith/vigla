import { setReporter } from 'vigla/internal/server';
import { format } from '../../shared/format.ts';
import { reporter } from '../report.ts';

setReporter(reporter);
setReporter(reporter, format);

export * from 'vigla/internal/server';
