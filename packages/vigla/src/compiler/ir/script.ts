import { parse, parseExpressionAt, type Options } from 'acorn';
import type * as ES from 'estree';
import { CompileError } from './port.ts';

const options: Options = {
	ecmaVersion: 'latest',
	sourceType: 'module',
	locations: true,
	allowAwaitOutsideFunction: true
};

function failure(error: unknown, fallback: number): CompileError {
	if (!(error instanceof SyntaxError)) throw error;
	const position = (error as SyntaxError & { pos?: number }).pos ?? fallback;
	const message = error.message.replace(/ \(\d+:\d+\)$/, '');
	return new CompileError({ code: 'js_parse_error', message, start: position, end: position });
}

export function parseProgram(source: string, start: number, end: number): ES.Program {
	const text = source.slice(0, start).replace(/[^\n]/g, ' ') + source.slice(start, end);
	try {
		return parse(text, options) as unknown as ES.Program;
	} catch (error) {
		throw failure(error, start);
	}
}

export function parseExpression(source: string, index: number): ES.Expression & { end: number } {
	try {
		return parseExpressionAt(source, index, options) as unknown as ES.Expression & { end: number };
	} catch (error) {
		throw failure(error, index);
	}
}
