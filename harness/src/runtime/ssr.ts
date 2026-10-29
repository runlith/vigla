import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Component } from 'svelte';
import type { CompileOptions } from 'svelte/compiler';
import { render } from 'svelte/server';
import { assert } from 'vitest';
import { htmlEqualWithOptions } from '../html.ts';
import { compileDirectory } from './compile.ts';
import type { SsrConfig, Variant } from './config.ts';
import type { Session } from './run.ts';
import type { Kind, Sample } from './suite.ts';

type Compiled = { default: Component<Record<string, unknown>> };

function read(path: string): string | undefined {
	return existsSync(path) ? readFileSync(path, 'utf8').replace(/\r\n/g, '\n') : undefined;
}

async function run(
	sample: Sample<SsrConfig>,
	variant: Variant,
	options: CompileOptions,
	session: Session
): Promise<void> {
	const { cwd, config } = sample;
	session.fresh.before();
	try {
		const component = (await import(join(cwd, '_output', 'server', 'main.svelte.js'))) as Compiled;
		let body: string;
		let head: string;
		let scripts: string[];
		try {
			const result = render(component.default, {
				props: config.props ?? {},
				idPrefix: config.id_prefix,
				csp: config.csp,
				transformError: config.transformError
			});
			const rendered = variant === 'async-ssr' ? await result : result;
			({ body, head } = rendered);
			scripts = rendered.hashes.script;
		} catch (error) {
			if (config.error) {
				assert.include((error as Error).message, config.error);
				return;
			}
			throw error;
		}

		if (config.error) assert.fail('Expected an error to be thrown, but rendering succeeded.');

		htmlEqualWithOptions(body, read(join(cwd, '_expected.html')) ?? '', {
			preserveComments: options.preserveComments,
			withoutNormalizeHtml: config.withoutNormalizeHtml
		});

		const expectedHead = read(join(cwd, '_expected_head.html'));
		if (expectedHead !== undefined) htmlEqualWithOptions(head, expectedHead, {});

		if (config.script_hashes !== undefined) assert.deepEqual(scripts, config.script_hashes);
	} finally {
		session.fresh.after();
	}
}

export const ssr: Kind<SsrConfig> = {
	root: 'repository',
	variants: ['ssr', 'async-ssr'],
	presence(variant, config, name) {
		const mode = variant === 'ssr' ? 'sync' : 'async';
		if (config.mode && !config.mode.includes(mode)) return 'absent';
		if (name.startsWith('async') && variant === 'ssr') return 'absent';
		return 'run';
	},
	compile: (cwd, options) => compileDirectory(cwd, 'server', options),
	run
};
