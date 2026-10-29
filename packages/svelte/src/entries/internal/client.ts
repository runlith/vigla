import { setReporter } from 'vigla/internal/client';
import { reporter } from '../report.ts';

setReporter(reporter);

export * from 'vigla/internal/client';
