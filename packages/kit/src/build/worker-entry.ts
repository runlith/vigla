import { enableVerboseErrors } from '../shared/diagnostics.ts';
import { adopt } from '../shared/identity.ts';
import { analyse } from './analysis.ts';
import type { PolicyIssue, PolicyReply, WorkerJob, WorkerMessage } from './jobs.ts';
import { prerender, renderShell } from './prerender.ts';
import { loadEmulator, loadRuntime } from './runtime.ts';

enableVerboseErrors();
let sequence = 0;
const answers = new Map<number, () => void>();
const report = (issue: PolicyIssue) =>
	new Promise<void>((resolve) => {
		const id = sequence++;
		answers.set(id, resolve);
		process.send!({ kind: 'policy', id, issue });
	});
process.on('message', (message: WorkerJob | PolicyReply) => {
	if (!('id' in message)) return;
	answers.get(message.id)?.();
	answers.delete(message.id);
});
process.on('disconnect', () => process.exit(1));
process.once('message', async (job: WorkerJob) => {
	let message: WorkerMessage;
	adopt(job.identity);
	try {
		const emulator = job.kind === 'prerender' ? await loadEmulator(job) : undefined;
		const runtime = await loadRuntime(job, job.kind !== 'analyse');
		runtime.emulator = emulator;
		if (job.kind === 'analyse') {
			const value = await analyse(runtime.manifest, job.hash);
			value.environment = runtime.environment.rendered;
			message = { kind: 'result', value };
		} else if (job.kind === 'fallback')
			message = { kind: 'result', value: await renderShell(runtime, job.origin, job.assets) };
		else message = { kind: 'result', value: await prerender(job, runtime, report) };
	} catch (cause) {
		const error = cause instanceof Error ? cause : new Error(String(cause));
		message = { kind: 'error', error: { message: error.message, stack: error.stack } };
	}
	process.send!(message, () => process.exit(0));
});
