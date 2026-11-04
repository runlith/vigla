import type { Identity, Links } from '../types/identity.ts';
import { identity } from './identity.ts';

export let verbose = false;

export function enableVerboseErrors(): void {
	verbose = true;
}

export interface Diagnostics {
	readonly identity: Identity;
	link(code: string): string;
	docs(link: keyof Links): string;
	text(code: string, text: string): string;
	raise(code: string, text: string, caller: Function): never;
	raiseCode(code: string): never;
	warn(code: string, text: string): void;
	warnCode(code: string): void;
}

export function diagnostics(identity: Identity): Diagnostics {
	const link = (code: string) => (identity.diagnostics ? identity.diagnostics + code : code);
	const trailer = (code: string) => (identity.diagnostics ? `\n${link(code)}` : '');
	const text = (code: string, text: string) => `${code}\n${text}${trailer(code)}`;
	return {
		identity,
		link,
		docs(name) {
			const url = identity.links?.[name];
			return url ? ` See ${url}` : '';
		},
		text,
		raise(code, message, caller) {
			const error = new Error(text(code, message));
			error.name = `${identity.product} error`;
			Error.captureStackTrace?.(error, caller);
			throw error;
		},
		raiseCode(code) {
			throw new Error(link(code));
		},
		warn(code, message) {
			console.warn(
				`%c[${identity.name}] ${code}\n%c${message}${trailer(code)}`,
				'font-weight: bold',
				'font-weight: normal'
			);
		},
		warnCode(code) {
			console.warn(link(code));
		}
	};
}

export const runtime: Diagnostics = diagnostics(identity);

export const diagnosticText: Diagnostics['text'] = runtime.text;
export const throwDiagnostic: Diagnostics['raise'] = runtime.raise;
export const throwCode: Diagnostics['raiseCode'] = runtime.raiseCode;
export const warnDiagnostic: Diagnostics['warn'] = runtime.warn;
export const warnCode: Diagnostics['warnCode'] = runtime.warnCode;
export const documentationLink: Diagnostics['docs'] = runtime.docs;
