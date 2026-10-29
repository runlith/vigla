import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { build, type Plugin } from 'esbuild';
import { chromium, type Browser } from 'playwright';
import { compile, compileModule, type CompileOptions, type Warning } from 'svelte/compiler';
import { assert, inject } from 'vitest';
import { root } from '../manifest.ts';
import { installed, targetFile, targetPackages, type Named } from '../resolve.ts';
import type { BrowserConfig, Variant } from '../runtime/config.ts';
import type { Kind, Sample } from '../runtime/suite.ts';
import type { Flags } from './driver.ts';

type Side = 'client' | 'server';

const props = join(root, 'src', 'runtime', 'props.svelte.js');

function target(packages: readonly Named[], side: Side): Plugin {
	return {
		name: 'harness:target',
		setup(build) {
			build.onResolve({ filter: /^(svelte|dromon)(\/|$)/ }, (args) => {
				const file = targetFile(packages, args.path, side);
				return file === null ? undefined : { path: file };
			});
		}
	};
}

function components(
	side: Side,
	options: CompileOptions,
	customElement: boolean,
	warnings: Warning[]
): Plugin {
	return {
		name: 'harness:svelte',
		setup(build) {
			build.onLoad({ filter: /\.svelte$/ }, (args) => {
				const compiled = compile(readFileSync(args.path, 'utf8').replace(/\r/g, ''), {
					...options,
					generate: side,
					customElement
				});
				if (side === 'client') warnings.push(...compiled.warnings);
				let contents = compiled.js.code;
				if (side === 'client' && compiled.css !== null) {
					contents += `document.head.innerHTML += \`<style>${compiled.css.code}</style>\``;
				}
				return { contents, loader: 'js' };
			});
			build.onLoad({ filter: /props\.svelte\.js$/ }, (args) => {
				if (args.path !== props) return undefined;
				const compiled = compileModule(readFileSync(args.path, 'utf8'), {
					filename: args.path,
					generate: 'client'
				});
				return { contents: compiled.js.code, loader: 'js' };
			});
		}
	};
}

function entry(side: Side, sample: Sample<BrowserConfig>, flags: Flags): string {
	const module = join(root, 'src', 'browser', side === 'client' ? 'driver.ts' : 'server.ts');
	const imports = [
		`import Main from ${JSON.stringify(join(sample.cwd, 'main.svelte'))};`,
		`import config from ${JSON.stringify(join(sample.cwd, '_config.js'))};`,
		`import run from ${JSON.stringify(module)};`
	];
	const call =
		side === 'client'
			? `export default (target) => run(Main, config, target, ${JSON.stringify(flags)});`
			: 'export default () => run(Main, config);';
	return [...imports, call].join('\n');
}

async function bundle(
	side: Side,
	sample: Sample<BrowserConfig>,
	options: CompileOptions,
	flags: Flags,
	warnings: Warning[]
): Promise<string> {
	const packages = installed(inject('target').root, targetPackages);
	const result = await build({
		stdin: { contents: entry(side, sample, flags), resolveDir: sample.cwd, loader: 'js' },
		write: false,
		bundle: true,
		format: 'iife',
		globalName: side === 'client' ? 'test' : 'test_ssr',
		platform: side === 'client' ? 'browser' : 'node',
		conditions: ['browser', 'production'],
		alias: { '@dromon/harness/helpers': join(root, 'src', 'helpers.ts') },
		plugins: [target(packages, side), components(side, options, flags.customElement, warnings)]
	});
	const [output] = result.outputFiles;
	if (output === undefined) throw new Error(`esbuild produced no ${side} bundle`);
	return output.text;
}

function checkWarnings(config: BrowserConfig, warnings: Warning[]): void {
	if (config.warnings) {
		assert.deepStrictEqual(
			warnings.map(({ code, message, start, end }) => ({ code, message, start, end })),
			config.warnings
		);
	} else if (warnings.length > 0) {
		console.warn(warnings);
		throw new Error('Received unexpected warnings');
	}
}

export class Chromium {
	#browser: Promise<Browser> | undefined;

	open(): Promise<Browser> {
		this.#browser ??= chromium.launch();
		return this.#browser;
	}

	async close(): Promise<void> {
		if (this.#browser !== undefined) await (await this.#browser).close();
		this.#browser = undefined;
	}
}

async function run(
	chromium: Chromium,
	sample: Sample<BrowserConfig>,
	options: CompileOptions,
	flags: Flags
): Promise<void> {
	const warnings: Warning[] = [];
	const client = await bundle('client', sample, options, flags, warnings);
	const server = flags.hydrate ? await bundle('server', sample, options, flags, []) : undefined;

	checkWarnings(sample.config, warnings);

	const page = await (await chromium.open()).newPage();
	try {
		page.on('console', (message) => {
			const type = message.type();
			const method = type === 'warning' ? 'warn' : type;
			const log = (console as unknown as Record<string, (...args: unknown[]) => void>)[method];
			(log ?? console.log)(message.text());
		});
		if (server !== undefined) {
			const rendered = (await page.evaluate(`${server}; test_ssr.default()`)) as {
				head: string;
				body: string;
			};
			await page.setContent(`<head>${rendered.head}</head><main>${rendered.body}</main>`);
		} else {
			await page.setContent('<main></main>');
		}
		const result: unknown = await page.evaluate(
			`${client};test.default(document.querySelector('main'))`
		);
		if (result) console.log(result);
	} catch (error) {
		const match = /Error: Expected "(.+)" to equal "(.+)"/.exec((error as Error).message);
		if (match) assert.equal(match[1], match[2]);
		throw error;
	} finally {
		await page.close();
	}
}

export function browser(customElement: boolean): Kind<BrowserConfig> {
	const chromium = new Chromium();
	return {
		root: 'sample',
		variants: customElement ? ['dom'] : ['dom', 'hydrate'],
		presence(variant: Variant, config: BrowserConfig) {
			if (variant !== 'hydrate') return 'run';
			if (config.mode && !config.mode.includes('hydrate')) return 'absent';
			return config.skip_mode?.includes('hydrate') ? 'skipped' : 'run';
		},
		compile: () => {},
		run: (sample, variant, options) =>
			run(chromium, sample, options, { hydrate: variant === 'hydrate', customElement }),
		concurrent: true,
		close: () => chromium.close()
	};
}
