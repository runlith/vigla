import { identity } from '../identity.ts';

export function diagnosticText(code: string, text: string): string {
	return `${code}\n${text}\n${identity.diagnostics}${code}`;
}

export function throwDiagnostic(code: string, text: string, caller: Function): never {
	const error = new Error(diagnosticText(code, text));
	error.name = `${identity.product} error`;
	Error.captureStackTrace?.(error, caller);
	throw error;
}

export function warningSource(code: string, text: string): string {
	return `console.warn(${JSON.stringify(`%c[${identity.name}] ${diagnosticText(code, text).replace('\n', '\n%c')}`)}, 'font-weight: bold', 'font-weight: normal');`;
}

export function warnDiagnostic(code: string, text: string): void {
	console.warn(
		`%c[${identity.name}] ${code}\n%c${text}\n${identity.diagnostics}${code}`,
		'font-weight: bold',
		'font-weight: normal'
	);
}
