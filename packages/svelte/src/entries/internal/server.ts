import { setReporter } from 'vigla/internal/server';
import { reporter } from '../report.ts';

setReporter(reporter);

export * from 'vigla/internal/server';
