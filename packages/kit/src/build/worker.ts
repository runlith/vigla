import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { PrerenderPolicy } from '../types/config.ts';
import type { BuildContext, Analysis } from './types.ts';
import * as e from './messages.ts';
import type {
	AnalysisJob,
	FallbackJob,
	PolicyIssue,
	PrerenderJob,
	PrerenderResult,
	WorkerJob,
	WorkerMessage,
	WorkerPlatform,
	WorkerValue
} from './jobs.ts';

function platform(context: BuildContext): WorkerPlatform {
	return {
		directory: `${context.config.outDir}/output`,
		assets: context.config.files.assets,
		origin: context.config.paths.origin || 'http://sveltekit-prerender',
		environment: context.environment
	};
}
async function applyPolicy<T extends { message: string }>(
	name: PolicyIssue['kind'],
	policy: PrerenderPolicy<T> | undefined,
	details: T,
	context: BuildContext
): Promise<void> {
	if (typeof policy === 'function') {
		await policy(details);
		return;
	}
	if (policy === 'ignore') return;
	if (policy === 'warn') {
		context.log.warn(details.message);
		return;
	}
	throw new Error(
		policy === 'fail' ? details.message : `${details.message}\n${e.prerender_policy_hint(name)}`
	);
}
async function policy(issue: PolicyIssue, context: BuildContext): Promise<void> {
	const settings = context.config.prerender;
	switch (issue.kind) {
		case 'handleHttpError':
			await applyPolicy(issue.kind, settings.handleHttpError, issue.details, context);
			break;
		case 'handleMissingId':
			await applyPolicy(issue.kind, settings.handleMissingId, issue.details, context);
			break;
		case 'handleEntryGeneratorMismatch':
			await applyPolicy(issue.kind, settings.handleEntryGeneratorMismatch, issue.details, context);
			break;
		case 'handleUnseenRoutes':
			await applyPolicy(issue.kind, settings.handleUnseenRoutes, issue.details, context);
			break;
		case 'handleInvalidUrl':
			await applyPolicy(issue.kind, settings.handleInvalidUrl, issue.details, context);
			break;
	}
}
function run(job: AnalysisJob, context: BuildContext): Promise<Analysis>;
function run(job: FallbackJob, context: BuildContext): Promise<string>;
function run(job: PrerenderJob, context: BuildContext): Promise<PrerenderResult>;
function run(job: WorkerJob, context: BuildContext): Promise<WorkerValue> {
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
		child.on('message', async (message: WorkerMessage) => {
			if (answered) return;
			if (message.kind === 'policy') {
				try {
					await policy(message.issue, context);
					if (!answered) child.send({ id: message.id });
				} catch (error) {
					answered = true;
					reject(error);
					child.kill();
				}
				return;
			}
			answered = true;
			if (message.kind === 'error') {
				const error = new Error(message.error.message);
				error.stack = message.error.stack;
				reject(error);
			} else resolve(message.value);
		});
		child.send(job);
	});
}
export function analyseBuild(context: BuildContext): Promise<Analysis> {
	return run(
		{ ...platform(context), kind: 'analyse', hash: context.config.router.type === 'hash' },
		context
	);
}
export function renderFallback(context: BuildContext): Promise<string> {
	return run({ ...platform(context), kind: 'fallback' }, context);
}
export function prerenderBuild(
	context: BuildContext,
	configFile?: string
): Promise<PrerenderResult> {
	return run(
		{
			...platform(context),
			kind: 'prerender',
			root: context.root,
			mode: context.mode,
			configFile,
			analysis: context.analysis,
			base: context.config.paths.base,
			hash: context.config.router.type === 'hash',
			entries: context.config.prerender.entries,
			crawl: context.config.prerender.crawl,
			concurrency: context.config.prerender.concurrency
		},
		context
	);
}
