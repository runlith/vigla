import { styleText } from 'node:util';
import { createDebug, enabled } from 'obug';
import type { Warning } from './compiler.ts';

type Level = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const levels: Level[] = ['debug', 'info', 'warn', 'error', 'silent'];
const on: Record<Level, boolean> = {
	debug: false,
	info: true,
	warn: true,
	error: true,
	silent: false
};
const colors: Record<'info' | 'warn' | 'error', Parameters<typeof styleText>[0]> = {
	info: 'cyan',
	warn: 'yellow',
	error: 'red'
};
const sinks = {
	info: (text: unknown) => console.log(text),
	warn: (text: unknown) => console.warn(text),
	error: (text: unknown) => console.error(text)
};
let current: Level = 'info';

export interface LogFn {
	(message: string, payload?: unknown, namespace?: string): void;
	readonly enabled: boolean;
	once(message: string, payload?: unknown, namespace?: string): void;
}

export interface Log {
	readonly debug: LogFn;
	readonly info: LogFn;
	readonly warn: LogFn;
	readonly error: LogFn;
	debugs(namespace: string): boolean;
	setLevel(level: string): void;
}

export function createLog(prefix: string): Log {
	const debugLog = createDebug(prefix);
	const debugs = (namespace: string): boolean => enabled(`${prefix}:${namespace}`);

	function write(level: Level, message: string, payload?: unknown, namespace?: string): void {
		if (!on[level]) return;
		if (level === 'debug') {
			if (namespace !== undefined && !debugs(namespace)) return;
			const debug = namespace === undefined ? debugLog : debugLog.extend(namespace);
			if (payload !== undefined) debug(message, payload);
			else debug(message);
			return;
		}
		if (level === 'silent') return;
		const scope = namespace === undefined ? prefix : `${prefix}:${namespace}`;
		const line = `${new Date().toLocaleTimeString()} [${scope}] ${message}`;
		sinks[level](styleText(colors[level], line));
		if (payload) sinks[level](payload);
	}

	function logger(level: Level): LogFn {
		const logged = new Set<string>();
		const fn = ((message: string, payload?: unknown, namespace?: string) =>
			write(level, message, payload, namespace)) as LogFn;
		Object.defineProperty(fn, 'enabled', { get: () => on[level] });
		Object.defineProperty(fn, 'once', {
			value: (message: string, payload?: unknown, namespace?: string) => {
				if (!on[level] || logged.has(message)) return;
				logged.add(message);
				write(level, message, payload, namespace);
			}
		});
		return fn;
	}

	return {
		debug: logger('debug'),
		info: logger('info'),
		warn: logger('warn'),
		error: logger('error'),
		debugs,
		setLevel(level) {
			if (level === current) return;
			const index = levels.indexOf(level as Level);
			if (index < 0) {
				write('error', `invalid log level: ${level} `);
				return;
			}
			current = level as Level;
			levels.forEach((name, at) => (on[name] = at >= index));
		}
	};
}

export function buildExtendedLogMessage(warning: Warning): string {
	const parts: (string | number)[] = [];
	if (warning.filename) parts.push(warning.filename);
	if (warning.start) parts.push(':', warning.start.line, ':', warning.start.column);
	if (warning.message) {
		if (parts.length > 0) parts.push(' ');
		parts.push(warning.message);
	}
	return parts.join('');
}
