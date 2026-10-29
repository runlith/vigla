import type { CompileOptions } from 'svelte/compiler';
import type { assert } from 'vitest';
import type { HtmlOptions } from '../html.ts';

export type Mode = 'server' | 'async-server' | 'client' | 'hydrate';

export type Variant = 'dom' | 'hydrate' | 'ssr' | 'async-ssr';

export type Assert = typeof assert & {
	htmlEqual(actual: string, expected: string, message?: string): void;
	htmlEqualWithOptions(
		actual: string,
		expected: string,
		options: HtmlOptions,
		message?: string
	): void;
};

export interface ClientArgs {
	variant: 'dom' | 'hydrate';
	assert: Assert;
	compileOptions: CompileOptions;
	component: Record<string, unknown>;
	instance: Record<string, unknown>;
	mod: Record<string, unknown>;
	ok: (value: unknown) => void;
	raf: { tick(time: number): void };
	snapshot: unknown;
	target: HTMLElement;
	window: Window & typeof globalThis;
	logs: unknown[];
	warnings: unknown[];
	errors: unknown[];
	hydrate: () => void;
}

export interface ServerArgs {
	logs: unknown[];
	warnings: unknown[];
	assert: Assert;
	variant: 'ssr' | 'async-ssr';
}

export interface Config {
	skip?: boolean;
	solo?: boolean;
	timeout?: number;
	mode?: Mode[];
	skip_mode?: Mode[];
	skip_no_async?: boolean;
	skip_async?: boolean;
	html?: string;
	ssrHtml?: string;
	compileOptions?: Partial<CompileOptions>;
	props?: Record<string, unknown>;
	server_props?: Record<string, unknown>;
	id_prefix?: string;
	before_test?: () => void;
	after_test?: () => void;
	skip_initial_flushSync?: boolean;
	snapshot?: (target: HTMLElement) => unknown;
	test?: (args: ClientArgs) => void | Promise<void>;
	test_ssr?: (args: ServerArgs) => void | Promise<void>;
	intro?: boolean;
	load_compiled?: boolean;
	error?: string;
	runtime_error?: string;
	warnings?: unknown[];
	errors?: unknown[];
	expect_unhandled_rejections?: boolean;
	withoutNormalizeHtml?: boolean | 'only-strip-comments';
	recover?: boolean;
	transformError?: (error: unknown) => unknown;
}
