import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { setImmediate } from 'node:timers/promises';
import { flushSync, hydrate, mount, unmount, type Component } from 'svelte';
import type { CompileOptions } from 'svelte/compiler';
import { render } from 'svelte/server';
import { assert } from 'vitest';
import { clock, raf } from '../clock.ts';
import { ok } from '../helpers.ts';
import { htmlEqual, htmlEqualWithOptions } from '../html.ts';
import type { Fresh } from '../target.ts';
import type { Assert, Config, Variant } from './config.ts';

export interface Sample {
	name: string;
	cwd: string;
	config: Config;
}

type Props = Record<string, unknown>;

type Compiled = { default: Component<Props, Props> };

export interface Session {
	fresh: Fresh;
	reactive: (value: Props) => Props;
}

export const asserts: Assert = Object.assign(Object.create(assert) as typeof assert, {
	htmlEqual,
	htmlEqualWithOptions
});

const original = { log: console.log, warn: console.warn, error: console.error };

const vitestListeners = process.rawListeners(
	'unhandledRejection'
) as NodeJS.UnhandledRejectionListener[];

let unhandled: unknown = null;

function onRejection(error: unknown): void {
	unhandled = error;
}

export function listen(): void {
	process.prependListener('unhandledRejection', onRejection);
	if (typeof window === 'undefined') return;
	const bridge = (
		window as unknown as {
			_virtualConsole?: { on(kind: string, listener: (...args: unknown[]) => void): void };
		}
	)._virtualConsole;
	for (const kind of ['log', 'warn', 'error'] as const) {
		bridge?.on(kind, (...args: unknown[]) => console[kind](...args));
	}
}

export function unlisten(): void {
	process.removeListener('unhandledRejection', onRejection);
}

function parameters(fn: ((...args: never[]) => unknown) | undefined): string {
	const source = fn?.toString() ?? '';
	let depth = 0;
	let index = 0;
	while (index < source.length) {
		if (source[index] === '(') depth++;
		if (source[index] === ')' && --depth === 0) break;
		index++;
	}
	return source.slice(0, index);
}

function styles(dir: string): string {
	let found: string[];
	try {
		found = readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter((file) =>
			file.endsWith('.css')
		);
	} catch {
		return '';
	}
	return found
		.map((file) => readFileSync(join(dir, file), 'utf8'))
		.join('\n')
		.replace(/\/\*<\/?style>\*\//g, '');
}

function runHeadScripts(): void {
	const script = [...document.head.querySelectorAll('script')].find((element) =>
		element.textContent?.includes('window.__svelte ??= {}')
	);
	if (script?.textContent) (0, eval)(script.textContent);
}

function svelteWarning(args: unknown[]): unknown[] {
	const [first] = args;
	if (typeof first !== 'string' || !first.startsWith('%c[svelte]')) return args;
	const lines = first.slice(first.indexOf('%c', 2) + 2).split('\n');
	if (lines.at(-1)?.startsWith('https://svelte.dev/e/')) lines.pop();
	return [lines.join('\n')];
}

export async function runVariant(
	sample: Sample,
	variant: Variant,
	compileOptions: CompileOptions,
	session: Session
): Promise<void> {
	const { cwd, config, name } = sample;
	const logs: unknown[] = [];
	const warnings: unknown[] = [];
	const errors: unknown[] = [];
	let unintended = false;
	let manual = false;
	let intercept = false;

	const onError = (event: ErrorEvent): void => {
		if (intercept) {
			const detail = event.error as { name?: string; message?: string; stack?: string } | undefined;
			const described = detail && detail.name && detail.message !== undefined && detail.stack;
			const text = described ? `[${detail.name}: ${detail.message}]` : String(detail);
			errors.push(`Error: Uncaught ${text}\n${detail?.stack ?? ''}`, detail);
		} else {
			unhandled = event.error;
		}
		event.preventDefault();
	};

	const client = parameters(config.test);
	const server = parameters(config.test_ssr);
	if (client.includes('logs') || server.includes('logs')) {
		console.log = (...args: unknown[]) => {
			logs.push(...args);
		};
	}
	if (client.includes('hydrate')) manual = true;
	if (client.includes('warnings') || config.warnings || server.includes('warnings')) {
		console.warn = (...args: unknown[]) => {
			warnings.push(...svelteWarning(args));
		};
	}
	if (client.includes('errors') || config.errors) {
		intercept = true;
		console.error = (...args: unknown[]) => {
			errors.push(...args);
		};
	}

	const htmlOptions = {
		preserveComments: config.withoutNormalizeHtml === 'only-strip-comments' ? false : undefined,
		withoutNormalizeHtml: !!config.withoutNormalizeHtml
	};

	try {
		unhandled = null;
		if (config.expect_unhandled_rejections) {
			for (const listener of vitestListeners)
				process.removeListener('unhandledRejection', listener);
		}

		clock.reset();

		const css = styles(join(cwd, '_output', 'client'));
		window.location.href = '';
		document.title = '';
		document.head.innerHTML = css ? `<style>${css}</style>` : '';
		document.body.innerHTML = '<main></main>';
		window.addEventListener('error', onError, true);

		const mod = (await import(join(cwd, '_output', 'client', 'main.svelte.js'))) as Compiled;
		const target = document.querySelector('main') as HTMLElement;
		session.fresh.before();

		let snapshot: unknown;

		if (variant === 'hydrate' || variant === 'ssr' || variant === 'async-ssr') {
			config.before_test?.();
			const component = (
				(await import(join(cwd, '_output', 'server', 'main.svelte.js'))) as Compiled
			).default;
			const result = render(component, {
				props: config.server_props ?? config.props ?? {},
				idPrefix: config.id_prefix,
				transformError: config.transformError
			});
			const rendered =
				variant === 'async-ssr' || (variant === 'hydrate' && compileOptions.experimental?.async)
					? await result
					: result;
			target.innerHTML = rendered.body;
			if (rendered.head) document.head.innerHTML += rendered.head;
			if (variant === 'hydrate' && config.snapshot) snapshot = config.snapshot(target);
		} else {
			target.innerHTML = '';
		}

		if (variant === 'ssr' || variant === 'async-ssr') {
			if (config.ssrHtml) htmlEqualWithOptions(target.innerHTML, config.ssrHtml, htmlOptions);
			else if (config.html) htmlEqualWithOptions(target.innerHTML, config.html, htmlOptions);
			if (config.test_ssr) await config.test_ssr({ logs, warnings, assert: asserts, variant });
			return;
		}

		logs.length = warnings.length = 0;
		config.before_test?.();

		let instance: Props | undefined;
		const props = session.reactive({ ...(config.props ?? {}) });
		let hydrateLater = (): void => {
			throw new Error('Ensure dom mode is skipped');
		};

		if (manual && variant === 'hydrate') {
			hydrateLater = () => {
				runHeadScripts();
				instance = hydrate(mod.default, {
					target,
					props,
					intro: config.intro,
					recover: config.recover ?? false
				});
			};
		} else {
			const options = {
				target,
				props,
				intro: config.intro,
				recover: config.recover ?? false,
				transformError: config.transformError
			};
			if (variant === 'hydrate') {
				runHeadScripts();
				instance = hydrate(mod.default, options);
			} else {
				instance = mount(mod.default, options);
			}
		}

		if (config.error) {
			unintended = true;
			assert.fail('Expected a runtime error');
		}

		if (config.html) {
			flushSync();
			htmlEqualWithOptions(target.innerHTML, config.html, htmlOptions);
		}

		try {
			if (config.test) {
				if (!config.skip_initial_flushSync) flushSync();
				if (variant === 'hydrate' && name.includes('async-')) await Promise.resolve();
				await config.test({
					assert: asserts,
					variant,
					component: props,
					instance: instance as Props,
					mod,
					ok,
					target,
					snapshot,
					window: window as Window & typeof globalThis,
					raf,
					compileOptions,
					logs,
					warnings,
					errors,
					hydrate: () => hydrateLater()
				});
				flushSync();
			}

			if (config.runtime_error && !unhandled) {
				unintended = true;
				assert.fail('Expected a runtime error');
			}
		} finally {
			await unmount(instance as Props);

			if (config.warnings) {
				assert.deepEqual(warnings, config.warnings);
			} else if (warnings.length && console.warn === original.warn) {
				unintended = true;
				original.warn.apply(console, warnings);
				assert.fail('Received unexpected warnings');
			}

			if (config.errors) {
				assert.deepEqual(errors, config.errors);
			} else if (errors.length && console.error === original.error) {
				unintended = true;
				original.error.apply(console, errors);
				assert.fail('Received unexpected errors');
			}

			htmlEqual(
				target.innerHTML,
				'',
				'Expected component to unmount and leave nothing behind after it was destroyed'
			);

			if (unhandled && !config.expect_unhandled_rejections) throw unhandled;
		}
	} catch (error) {
		if (config.runtime_error) {
			assert.include((error as Error).message, config.runtime_error);
		} else if (config.error && !unintended) {
			assert.include((error as Error).message, config.error);
		} else {
			throw error;
		}
	} finally {
		window.removeEventListener('error', onError, true);
		config.after_test?.();
		await setImmediate();
		if (config.expect_unhandled_rejections) {
			for (const listener of vitestListeners) process.on('unhandledRejection', listener);
		}
		console.log = original.log;
		console.warn = original.warn;
		console.error = original.error;
		session.fresh.after();
	}
}
