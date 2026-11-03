import { snapshot } from '../../shared/clone.ts';
import { formatFrame } from '../../shared/diagnostics.ts';
import { eager, template } from '../reactivity/effects.ts';
import { untrack } from '../reactivity/tracking.ts';

const internal =
	/\/vigla\/src\/(runtime\/(reactivity|dom|server)|shared)\/|\/vigla\/src\/runtime\/classes\/subscriber\.ts/;

function stackOf(label: string): Error | null {
	const limit = Error.stackTraceLimit;
	Error.stackTraceLimit = Infinity;
	const stack = new Error().stack;
	Error.stackTraceLimit = limit;
	if (stack === undefined) return null;
	const lines: string[] = [];
	for (const line of stack.split('\n')) {
		if (line.trim() === 'Error' || internal.test(line.replaceAll('\\', '/'))) continue;
		const shown = formatFrame(line);
		if (shown !== null) lines.push(shown);
	}
	if (lines.length === 0) return null;
	const error = new Error();
	Object.defineProperty(error, 'stack', { value: ['\n', ...lines].join('\n') });
	Object.defineProperty(error, 'name', { value: label });
	return error;
}

const unset = Symbol('unset');

export function inspect(
	get: () => readonly unknown[],
	inspector: (...values: unknown[]) => void,
	stack = false
): void {
	let initial = true;
	let error: unknown = unset;
	eager(() => {
		error = unset;
		let values: readonly unknown[];
		try {
			values = get();
		} catch (caught) {
			error = caught;
			return;
		}
		const copied = snapshot(values, true) as readonly unknown[];
		untrack(() => {
			if (!stack) {
				inspector(initial ? 'init' : 'update', ...copied);
				return;
			}
			inspector(...copied);
			if (initial) return;
			const trace = stackOf('$inspect(...)');
			if (trace === null) return;
			console.groupCollapsed('stack trace');
			console.log(trace);
			console.groupEnd();
		});
		initial = false;
	});
	template(() => {
		try {
			get();
		} catch {}
		if (error === unset) return;
		console.error(error);
		error = unset;
	});
}
