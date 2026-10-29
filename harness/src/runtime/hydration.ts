import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { flushSync, hydrate, unmount, type Component } from 'svelte';
import { render } from 'svelte/server';
import { assert } from 'vitest';
import { htmlEqual } from '../html.ts';
import type { Assert, HydrationConfig } from './config.ts';
import { asserts, type Session } from './run.ts';
import { compileBoth, type Kind, type Sample } from './suite.ts';

type Props = Record<string, unknown>;

type Compiled = { default: Component<Props, Props> };

function read(path: string): string | undefined {
	return existsSync(path) ? readFileSync(path, 'utf8') : undefined;
}

async function run(sample: Sample<HydrationConfig>, session: Session): Promise<void> {
	const { cwd, config } = sample;
	session.fresh.before();
	try {
		config.before_test?.();

		const target = document.body;
		const head = document.head;
		const server = (await import(join(cwd, '_output', 'server', 'main.svelte.js'))) as Compiled;
		const rendered = await render(server.default, {
			props: config.server_props ?? config.props ?? {},
			idPrefix: config.id_prefix
		});

		const override = read(join(cwd, '_override.html'));
		const overrideHead = read(join(cwd, '_override_head.html'));
		target.innerHTML = override ?? rendered.body;
		if (rendered.head) head.innerHTML = overrideHead ?? rendered.head;

		const snapshot = config.snapshot ? config.snapshot(target) : {};

		const warn = console.warn;
		const errors: unknown[] = [];
		let mismatch = false;
		console.warn = (...args: unknown[]) => {
			const [text] = args;
			if (typeof text === 'string' && text.startsWith('%c[svelte]')) {
				const code = text.slice(11, text.indexOf('\n%c', 11));
				const lines = text.slice(text.indexOf('%c', 2) + 2).split('\n');
				if (lines.at(-1)?.startsWith('https://svelte.dev/e/')) lines.pop();
				const message = lines.join('\n');
				if (code === 'hydration_mismatch') {
					mismatch = true;
					if (!config.expect_hydration_error) warn(message);
				} else {
					errors.push(message);
				}
			} else {
				errors.push(...args);
			}
		};

		const client = (await import(join(cwd, '_output', 'client', 'main.svelte.js'))) as Compiled;
		const component = session.reactive({ ...(config.props ?? {}) });
		let instance: Props;
		try {
			instance = hydrate(client.default, { target, props: component });
			flushSync();
		} finally {
			console.warn = warn;
		}

		if (config.expect_hydration_error) assert.ok(mismatch, 'Expected hydration error');
		else assert.ok(!mismatch, 'Unexpected hydration error');

		if (config.errors) assert.deepEqual(errors, config.errors);
		else if (errors.length > 0) throw new Error(`Unexpected errors: ${errors.join('\n')}`);

		flushSync();

		htmlEqual(target.innerHTML, read(join(cwd, '_expected.html')) ?? rendered.body);
		if (rendered.head) {
			htmlEqual(head.innerHTML, read(join(cwd, '_expected_head.html')) ?? rendered.head);
		}

		if (config.snapshot) {
			const after = config.snapshot(target);
			const before = snapshot as Record<string, unknown>;
			for (const key in after) {
				assert.ok(
					after[key] === before[key],
					`Expected snapshot key "${key}" to have same value/reference`
				);
			}
		}

		if (config.test) {
			await config.test(
				asserts as Assert,
				target,
				snapshot,
				component,
				window as Window & typeof globalThis
			);
		}

		void unmount(instance);
		htmlEqual(target.innerHTML, '');
	} finally {
		config.after_test?.();
		session.fresh.after();
	}
}

export const hydration: Kind<HydrationConfig> = {
	root: 'repository',
	variants: ['hydrate'],
	presence: () => 'run',
	compile: compileBoth,
	run: (sample, _variant, _options, session) => run(sample, session)
};
