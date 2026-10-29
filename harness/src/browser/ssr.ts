import { join } from 'node:path';
import { setImmediate } from 'node:timers/promises';
import type { Component } from 'svelte';
import { render } from 'svelte/server';
import { htmlEqualWithOptions } from '../html.ts';
import { compileDirectory } from '../runtime/compile.ts';
import type { BrowserConfig } from '../runtime/config.ts';
import type { Kind } from '../runtime/suite.ts';

type Compiled = { default: Component<Record<string, unknown>> };

export const browserSsr: Kind<BrowserConfig> = {
	root: 'repository',
	variants: ['ssr'],
	presence: () => 'run',
	compile: () => {},
	async run({ cwd, config }, _variant, options, session) {
		if (config.mode && !config.mode.includes('server')) return;
		if (config.skip_mode?.includes('server')) return;
		session.fresh.before();
		try {
			compileDirectory(cwd, 'server', options);
			const component = (await import(
				join(cwd, '_output', 'server', 'main.svelte.js')
			)) as Compiled;
			const { body } = render(component.default, {
				props: config.props ?? {},
				idPrefix: config.id_prefix
			});
			const expected = config.ssrHtml || config.html;
			if (expected) {
				htmlEqualWithOptions(body, expected, {
					preserveComments: config.compileOptions?.preserveComments
				});
			}
		} finally {
			session.fresh.after();
		}
		await setImmediate();
	}
};
