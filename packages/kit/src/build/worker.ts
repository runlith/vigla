import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { BuildContext } from './types.ts';

export interface FallbackJob {
	directory: string;
	assets: string;
	origin: string;
	environment: Record<string, string | undefined>;
}
export type FallbackResult = { value: string } | { error: { message: string; stack?: string } };

export function renderFallback(context: BuildContext): Promise<string> {
	const job: FallbackJob = {
		directory: `${context.config.outDir}/output`,
		assets: context.config.files.assets,
		origin: context.config.paths.origin || 'http://sveltekit-prerender',
		environment: context.environment
	};
	return new Promise((resolve, reject) => {
		const child = fork(fileURLToPath(new URL('./worker-entry.ts', import.meta.url)), [], {
			serialization: 'advanced',
			stdio: ['inherit', 'inherit', 'inherit', 'ipc']
		});
		let answered = false;
		child.once('error', reject);
		child.once('exit', (code, signal) => {
			if (!answered) reject(new Error(`Build worker exited before answering (${signal ?? code})`));
		});
		child.once('message', (result: FallbackResult) => {
			answered = true;
			if ('error' in result) {
				const error = new Error(result.error.message);
				error.stack = result.error.stack;
				reject(error);
			} else resolve(result.value);
		});
		child.send(job);
	});
}
