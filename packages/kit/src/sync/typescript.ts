import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { ValidatedConfig } from '../types/builder.ts';
import * as configErrors from '../config/errors.ts';
import { warnDiagnostic } from '../shared/diagnostics.ts';
import { filesUnder, posix, relativeFile, writeChanged } from './files.ts';
import * as errors from './errors.ts';

interface CompilerOptions {
	paths?: Record<string, string[]>;
	rootDirs?: string[];
	types?: string[];
	[key: string]: unknown;
}
interface ProjectConfig {
	extends?: string | string[];
	compilerOptions?: CompilerOptions;
	include?: string[];
	exclude?: string[];
	[key: string]: unknown;
}
const required = { verbatimModuleSyntax: true, isolatedModules: true };
const recommended = {
	allowJs: true,
	checkJs: true,
	forceConsistentCasingInFileNames: true,
	resolveJsonModule: true,
	moduleDetection: 'force',
	moduleResolution: 'bundler',
	allowImportingTsExtensions: true,
	module: 'esnext',
	target: 'esnext',
	skipLibCheck: true,
	esModuleInterop: true,
	noEmit: true
};

function parseConfig(file: string): ProjectConfig {
	const source = readFileSync(file, 'utf8');
	let clean = '';
	let state: 'string' | 'line' | 'block' | null = null;
	for (let i = 0; i < source.length; i++) {
		const char = source[i]!;
		const pair = source.slice(i, i + 2);
		if (state === 'string') {
			clean += char;
			if (char === '\\') clean += source[++i] ?? '';
			else if (char === '"') state = null;
		} else if (state === 'line') {
			clean += char === '\n' ? '\n' : ' ';
			if (char === '\n') state = null;
		} else if (state === 'block') {
			if (pair === '*/') {
				clean += '  ';
				i++;
				state = null;
			} else clean += char === '\n' ? '\n' : ' ';
		} else if (pair === '//' || pair === '/*') {
			state = pair === '//' ? 'line' : 'block';
			clean += '  ';
			i++;
		} else {
			clean += char;
			if (char === '"') state = 'string';
		}
	}
	const characters = clean.split('');
	let quoted = false;
	for (let i = 0; i < characters.length; i++) {
		if (quoted && characters[i] === '\\') {
			i++;
			continue;
		}
		if (characters[i] === '"') {
			quoted = !quoted;
			continue;
		}
		if (!quoted && characters[i] === ',' && /^\s*[}\]]/.test(clean.slice(i + 1)))
			characters[i] = ' ';
	}
	clean = characters.join('');
	try {
		return JSON.parse(clean) as ProjectConfig;
	} catch (failure) {
		try {
			errors.tsconfig_parse_failed({
				file: relativeFile(process.cwd(), file),
				details: failure instanceof Error ? failure.message : String(failure)
			});
		} catch (error) {
			if (error instanceof Error) {
				const message = failure instanceof Error ? failure.message : '';
				const lineColumn = /line (\d+) column (\d+)/.exec(message);
				const position = Number(/position (\d+)/.exec(message)?.[1] ?? 0);
				const prefix = clean.slice(0, position);
				const line = lineColumn?.[1] ?? String(prefix.split('\n').length);
				const column = lineColumn?.[2] ?? String(position - prefix.lastIndexOf('\n'));
				error.stack = `${error.message}\n    at ${relativeFile(process.cwd(), file)}:${line}:${column}`;
			}
			throw error;
		}
	}
}

const sourceFile = /\.[cm]?[jt]sx?$/;
function pattern(glob: string): RegExp {
	const source = posix(glob).replace(/^\.\//, '').replace(/\/$/, '');
	let expression = '';
	for (let i = 0; i < source.length; i++) {
		if (source.startsWith('**/', i)) {
			expression += '(?:[^/]*/)*';
			i += 2;
		} else if (source.startsWith('**', i)) {
			expression += '.*';
			i++;
		} else if (source[i] === '*') expression += '[^/]*';
		else if (source[i] === '?') expression += '[^/]';
		else expression += source[i]!.replace(/[.+^${}()|[\]\\]/g, '\\$&');
	}
	return new RegExp(`^${expression}(?:/.*)?$`);
}
function matches(globs: string[], name: string): boolean {
	return globs.some((glob) => pattern(glob).test(name));
}

function pathAliases(config: ValidatedConfig, root: string): Record<string, string[]> {
	const paths: Record<string, string[]> = {};
	for (const [key, value] of Object.entries(config.alias)) {
		if (!/^.+?(?:\/\*)?$/.test(key)) configErrors.config_alias_key_invalid({ key });
		if (!/^.+?(?:\/\*|\.\w+)?$/.test(value)) configErrors.config_alias_value_invalid({ value });
		const target = resolve(root, value.replace(/\/\*$/, ''));
		paths[key] = [target + (key.endsWith('/*') ? '/*' : '')];
		if (!key.endsWith('/*') && !/\.\w+$/.test(value) && !Object.hasOwn(config.alias, key + '/*'))
			paths[key + '/*'] = [target + '/*'];
	}
	return paths;
}

function tsconfig_extends_missing(file: string, example: ProjectConfig): void {
	warnDiagnostic(
		'tsconfig_extends_missing',
		`${file} should extend the generated configuration:\n${JSON.stringify(example, null, 2)}`
	);
}
function tsconfig_invalid(file: string, issues: string[]): void {
	warnDiagnostic(
		'tsconfig_invalid',
		`${file} has invalid configuration:\n${issues.map((issue) => `- ${issue}`).join('\n')}`
	);
}

export function writeTsconfig(config: ValidatedConfig, root: string): void {
	const paths = pathAliases(config, root);
	const types = ['$app/types'];
	const compilerOptions: CompilerOptions = {
		paths,
		rootDirs: [root, join(config.outDir, 'types')],
		types,
		lib: ['ESNext', 'DOM', 'DOM.Iterable'],
		...required,
		...recommended
	};
	const write = (
		id: string,
		options: CompilerOptions,
		transform?: ValidatedConfig['typescript']['config']
	): ProjectConfig => {
		const file = join(root, 'node_modules', id + '.json');
		const normalized: ProjectConfig = {
			compilerOptions: {
				...options,
				paths: Object.fromEntries(
					Object.entries(options.paths ?? {}).map(([key, values]) => [
						key,
						values.map((value) => relativeFile(dirname(file), value))
					])
				),
				rootDirs: options.rootDirs?.map((value) => relativeFile(dirname(file), value))
			}
		};
		const result = transform?.(normalized) ?? normalized;
		writeChanged(file, JSON.stringify(result, null, '\t'));
		return result;
	};
	const parent = write('$app/tsconfig', compilerOptions, config.typescript.config);
	const worker = write('$app/tsconfig/service-worker', {
		paths,
		types,
		lib: ['ESNext', 'WebWorker'],
		...required,
		...recommended
	});
	const validate = (
		directory: string,
		id: string,
		exclusions: string[],
		example: ProjectConfig,
		base: ProjectConfig
	): void => {
		const file = ['tsconfig.json', 'jsconfig.json']
			.map((name) => join(directory, name))
			.find(existsSync);
		if (!file) return;
		const parsed = parseConfig(file);
		const bases = typeof parsed.extends === 'string' ? [parsed.extends] : (parsed.extends ?? []);
		if (!bases.includes(id)) {
			tsconfig_extends_missing(relativeFile(root, file), example);
			return;
		}
		const options = { ...base.compilerOptions, ...parsed.compilerOptions };
		const issues: string[] = [];
		if (options.types && !options.types.includes('$app/types'))
			issues.push('"types" was overwritten. It must include "$app/types"');
		if (parsed.compilerOptions?.paths) {
			const mismatch = Object.entries(paths).filter(
				([key, expected]) =>
					JSON.stringify(options.paths![key]?.map((value) => resolve(directory, value))) !==
					JSON.stringify(expected)
			);
			if (mismatch.length)
				issues.push(
					`"paths" was overwritten. Imports from ${[...new Set(mismatch.map(([key]) => key.replace(/\/\*$/, '')))].map((key) => JSON.stringify(key)).join(' and ')} may not typecheck`
				);
		}
		for (const exclusion of exclusions) {
			const included = filesUnder(dirname(exclusion)).some((path) => {
				if (!sourceFile.test(path)) return false;
				if (
					path !== exclusion &&
					!path.startsWith(exclusion + '/') &&
					!path.startsWith(exclusion + '.')
				)
					return false;
				const name = relativeFile(directory, path);
				return matches(parsed.include ?? ['**/*'], name) && !matches(parsed.exclude ?? [], name);
			});
			if (included)
				issues.push(
					`${JSON.stringify(relativeFile(directory, exclusion))} should be added to the "exclude" array`
				);
		}
		for (const key of Object.keys(required))
			if (options[key] !== true)
				issues.push(`${JSON.stringify(key)} was overwritten. It should be true`);
		if (issues.length) tsconfig_invalid(relativeFile(root, file), issues);
	};
	validate(
		root,
		'$app/tsconfig',
		[config.files.serviceWorker],
		{ extends: '$app/tsconfig', include: ['src', 'test', '*'], exclude: ['src/service-worker'] },
		parent
	);
	validate(
		config.files.serviceWorker,
		'$app/tsconfig/service-worker',
		[],
		{ extends: '$app/tsconfig/service-worker' },
		worker
	);
}
