import { DEV } from 'esm-env';
import {
	goto as navigate,
	pushState as push,
	replaceState as replace,
	type GotoOptions
} from '$app/navigation';
import { throwDiagnostic, warnDiagnostic } from '../diagnostics.ts';

export * from '$app/navigation';

interface RetiredGotoOptions extends GotoOptions {
	replaceState?: boolean;
	invalidateAll?: boolean;
	noScroll?: boolean;
	keepFocus?: boolean;
}

const warned = new Set<string>();

function warnOnce(code: string, text: string): void {
	if (warned.has(code)) return;
	warned.add(code);
	warnDiagnostic(code, text);
}

export async function goto(url: string | URL, options: RetiredGotoOptions = {}): Promise<void> {
	const { replaceState, invalidateAll, noScroll, keepFocus, ...current } = options;
	if (DEV) {
		if ('replaceState' in options)
			warnOnce(
				'goto_replace_state_deprecated',
				`The \`goto(..., { replaceState: ${String(replaceState)} })\` option has been deprecated in favour of \`replace\``
			);
		if ('noScroll' in options || 'keepFocus' in options)
			throwDiagnostic(
				'goto_options_removed',
				'The `goto(..., { noScroll: true, keepFocus: true })` options have been replaced by `reset: false`',
				goto
			);
		if ('invalidateAll' in options)
			warnOnce(
				'goto_invalidate_all_deprecated',
				`The \`goto(..., { invalidateAll: ${String(invalidateAll)} })\` option has been deprecated in favour of \`refreshAll\``
			);
	}
	return navigate(url, {
		...current,
		replace: current.replace ?? replaceState,
		refreshAll: current.refreshAll ?? invalidateAll
	});
}

export function pushState(url: string | URL, state: App.PageState): Promise<void> {
	if (DEV)
		warnOnce(
			'push_state_deprecated',
			'`pushState(...)` is deprecated. Use `goto(url, { state, shallow: true })` instead.'
		);
	return push(url, state);
}

export function replaceState(url: string | URL, state: App.PageState): Promise<void> {
	if (DEV)
		warnOnce(
			'replace_state_deprecated',
			'`replaceState(...)` is deprecated. Use `goto(url, { state, shallow: true, replace: true })` instead.'
		);
	return replace(url, state);
}
