import { setReporter } from 'dromon/internal/server';
import { reporter } from '../report.ts';

setReporter(reporter);

export * from 'dromon/internal/server';
