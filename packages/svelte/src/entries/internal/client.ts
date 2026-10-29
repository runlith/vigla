import { setReporter } from 'dromon/internal/client';
import { reporter } from '../report.ts';

setReporter(reporter);

export * from 'dromon/internal/client';
