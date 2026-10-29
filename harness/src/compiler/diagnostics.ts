import { existsSync, readFileSync } from 'node:fs';

export interface Position {
	line?: number;
	column?: number;
}

export interface Diagnostic {
	code: string;
	message: string;
	start?: Position;
	end?: Position;
	position?: [number, number];
}

export function stripLink(message: string): string {
	return message.slice(0, message.lastIndexOf('\n'));
}

export function readJson<T>(file: string): T | null {
	return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as T) : null;
}

export function readText(file: string): string {
	return readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

export function readOptional(file: string): string | null {
	return existsSync(file) ? readText(file) : null;
}
