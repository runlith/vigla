import type { Analysis } from './types.ts';
import type { Prerendered, PrerenderOption } from '../types/builder.ts';
import type {
	PrerenderHttpError,
	PrerenderMissingId,
	PrerenderEntryMismatch,
	PrerenderUnseenRoutes,
	PrerenderInvalidUrl
} from '../types/config.ts';

export interface WorkerPlatform {
	directory: string;
	assets: string;
	origin: string;
	environment: Record<string, string | undefined>;
}
export interface FallbackJob extends WorkerPlatform {
	kind: 'fallback';
}
export interface AnalysisJob extends WorkerPlatform {
	kind: 'analyse';
	hash: boolean;
}
export interface PrerenderJob extends WorkerPlatform {
	kind: 'prerender';
	root: string;
	mode: string;
	configFile?: string;
	analysis: Analysis;
	base: string;
	hash: boolean;
	entries: Array<'*' | `/${string}`>;
	crawl: boolean;
	concurrency: number;
}
export interface PrerenderResult {
	prerendered: Prerendered;
	prerenderMap: Map<string, PrerenderOption>;
}
export type WorkerJob = FallbackJob | AnalysisJob | PrerenderJob;
export type WorkerValue = string | Analysis | PrerenderResult;
export type PolicyIssue =
	| { kind: 'handleHttpError'; details: PrerenderHttpError }
	| { kind: 'handleMissingId'; details: PrerenderMissingId }
	| { kind: 'handleEntryGeneratorMismatch'; details: PrerenderEntryMismatch }
	| { kind: 'handleUnseenRoutes'; details: PrerenderUnseenRoutes }
	| { kind: 'handleInvalidUrl'; details: PrerenderInvalidUrl };
export type WorkerMessage =
	| { kind: 'result'; value: WorkerValue }
	| { kind: 'error'; error: { message: string; stack?: string } }
	| { kind: 'policy'; id: number; issue: PolicyIssue };
export interface PolicyReply {
	id: number;
}
export type PolicyReporter = (issue: PolicyIssue) => Promise<void>;
