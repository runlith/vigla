import { existsSync } from 'node:fs';
import path from 'node:path';
import type { InitializerOptions, InstrumentOptions } from '../types/builder.ts';
import { copy, posix, specifier, write } from './files.ts';
import * as e from './messages.ts';

export function initializer(options: InitializerOptions, server: string): string {
	const provider = path.join(options.outputDirectory, '__sveltekit_env.js');
	write(provider, options.environment ?? 'export default process.env;');
	const file = path.join(options.outputDirectory, '__sveltekit_env_init.js');
	const environment = specifier(path.dirname(file), provider);
	const target = specifier(
		path.dirname(file),
		path.join(options.serverDirectory ?? server, 'env.js')
	);
	write(
		file,
		`import env from ${JSON.stringify(environment)};\nimport { set_env } from ${JSON.stringify(target)};\nawait set_env(env);\n`
	);
	return file;
}

export function instrument(options: InstrumentOptions): void {
	for (const [kind, file] of [
		['Instrumentation file', options.instrumentation],
		['Entrypoint file', options.entrypoint],
		['Instrumentation initializer', options.initializer]
	]) {
		if (!existsSync(file!)) e.adapter_instrumentation_file_missing({ kind: kind!, file: file! });
	}
	const directory = path.dirname(options.entrypoint);
	const start = options.start ?? path.join(directory, 'start.js');
	copy(options.entrypoint, start);
	if (existsSync(options.entrypoint + '.map')) copy(options.entrypoint + '.map', start + '.map');
	const paths = {
		initializer: posix(path.relative(directory, options.initializer)),
		instrumentation: posix(path.relative(directory, options.instrumentation)),
		start: posix(path.relative(directory, start))
	};
	const module = options.module ?? { exports: ['default'] };
	if ('generateText' in module) {
		write(options.entrypoint, module.generateText(paths));
		return;
	}
	const lines = [
		`import ${JSON.stringify(specifier(directory, options.initializer))};`,
		`await import(${JSON.stringify(specifier(directory, options.instrumentation))});`,
		`const entry = await import(${JSON.stringify(specifier(directory, start))});`
	];
	module.exports.forEach((name, index) =>
		lines.push(
			`const value${index} = entry[${JSON.stringify(name)}]; export { value${index} as ${JSON.stringify(name)} };`
		)
	);
	write(options.entrypoint, lines.join('\n'));
}
