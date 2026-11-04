import { diagnosticLink, identity } from './identity.ts';

export let verbose = false;

export function enableVerboseErrors(): void {
	verbose = true;
}

function trailer(code: string): string {
	return identity.diagnostics ? `\n${diagnosticLink(code)}` : '';
}

export function diagnosticText(code: string, text: string): string {
	return `${code}\n${text}${trailer(code)}`;
}

export function throwDiagnostic(code: string, text: string, caller: Function): never {
	const error = new Error(diagnosticText(code, text));
	error.name = `${identity.product} error`;
	Error.captureStackTrace?.(error, caller);
	throw error;
}

export function throwCode(code: string): never {
	throw new Error(diagnosticLink(code));
}

export function warnCode(code: string): void {
	console.warn(diagnosticLink(code));
}

export function warnDiagnostic(code: string, text: string): void {
	console.warn(
		`%c[${identity.name}] ${code}\n%c${text}${trailer(code)}`,
		'font-weight: bold',
		'font-weight: normal'
	);
}
