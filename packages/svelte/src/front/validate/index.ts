import type { Diagnostic } from 'dromon/compiler';
import type { Parsed } from '../parse/index.ts';
import { Report } from './report.ts';

export function validateComponent(parsed: Parsed): Diagnostic[] {
	const report = new Report();
	report.add(parsed.warnings);
	return report.warnings;
}
