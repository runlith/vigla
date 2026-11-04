import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	rmdirSync,
	unlinkSync,
	writeFileSync
} from 'node:fs';
import { parseArgs, styleText } from 'node:util';

const help = (command: string) => `
  Usage: ${command} <command> [options]

  Commands:
    sync                   Synchronise generated type definitions

  Options:
    --version, -v          Show version number
    --help, -h             Show this help message

  Sync Options:
    --config, -c <config>  Specify a custom Vite config file
    --mode <mode>          Specify a mode for loading environment variables (default: development)
`;

function reportError(failure: unknown): void {
	const error = failure instanceof Error ? failure : new Error(JSON.stringify(failure));
	if (error.name === 'SyntaxError') throw error;
	console.error(styleText(['bold', 'red'], `> ${error.message}`));
	if (error.stack) console.error(styleText('grey', error.stack.split('\n').slice(1).join('\n')));
	process.exitCode = 1;
}

async function sync(file: string | undefined, mode: string): Promise<void> {
	const directory = 'node_modules/$app';
	const tsconfig = `${directory}/tsconfig.json`;
	const hadDirectory = existsSync(directory);
	const hadConfig = existsSync(tsconfig);
	try {
		if (!hadConfig) {
			mkdirSync(directory, { recursive: true });
			writeFileSync(tsconfig, '{}');
		}
		const { loadConfig } = await import('../config/file.ts');
		const { config, vite, api } = await loadConfig(process.cwd(), file);
		const { createSync, loadEnvironment } = await import('./index.ts');
		const generated = createSync(config, vite.root);
		await generated.initial(mode);
		const environment = await loadEnvironment(config, vite.root, mode, api);
		generated.writeEnvironment(environment.file, environment.variables);
	} catch (error) {
		reportError(error);
	} finally {
		if (!hadConfig && existsSync(tsconfig) && readFileSync(tsconfig, 'utf8') === '{}')
			unlinkSync(tsconfig);
		if (!hadDirectory && existsSync(directory) && readdirSync(directory).length === 0)
			rmdirSync(directory);
	}
}

function parse(args: string[], usage: string) {
	try {
		return parseArgs({
			args,
			allowPositionals: true,
			strict: true,
			options: {
				version: { type: 'boolean', short: 'v' },
				help: { type: 'boolean', short: 'h' },
				config: { type: 'string', short: 'c' },
				mode: { type: 'string', default: 'development' }
			}
		});
	} catch (error) {
		console.error(styleText(['bold', 'red'], `> ${(error as Error).message}`));
		console.log(usage);
		process.exit(1);
	}
}

export async function cli(args: string[], version: string, command: string): Promise<void> {
	const usage = help(command);
	const { values, positionals } = parse(args, usage);
	if (values.version) {
		console.log(version);
	} else if (values.help || positionals.length === 0) {
		console.log(usage);
	} else if (positionals[0] === 'sync') {
		await sync(values.config, values.mode);
	} else {
		console.error(styleText(['bold', 'red'], `> Unknown command: ${positionals[0]}`));
		console.log(usage);
		process.exitCode = 1;
	}
}
