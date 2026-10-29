import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Variant } from './runtime/config.ts';

export type Status = 'contract' | 'converted' | 'dropped' | 'difference' | 'covered';

export const statuses: readonly Status[] = [
	'contract',
	'converted',
	'dropped',
	'difference',
	'covered'
];

export interface Ruling {
	status: Status;
	reason?: string;
}

export interface Ruled extends Ruling {
	variants?: Partial<Record<Variant, Ruling>>;
}

export type Entry = 'contract' | Ruled;

export interface Manifest {
	samples: Record<string, Entry>;
}

export const root = join(import.meta.dirname, '..');

export function manifestPath(project: string, suite: string): string {
	return join(root, 'manifest', project, `${suite}.json`);
}

export function load(project: string, suite: string): Manifest {
	return JSON.parse(readFileSync(manifestPath(project, suite), 'utf8')) as Manifest;
}

export function ruling(manifest: Manifest, sample: string, variant?: Variant): Ruling | undefined {
	const entry = manifest.samples[sample];
	if (entry === undefined) return undefined;
	if (entry === 'contract') return { status: 'contract' };
	return (
		(variant === undefined ? undefined : entry.variants?.[variant]) ?? {
			status: entry.status,
			...(entry.reason === undefined ? {} : { reason: entry.reason })
		}
	);
}

export function runs(status: Status): boolean {
	return status === 'contract' || status === 'converted';
}

export function faults(manifest: Manifest): string[] {
	const found: string[] = [];
	const check = (key: string, value: Ruling): void => {
		if (!statuses.includes(value.status))
			found.push(`${key}: unknown status ${String(value.status)}`);
		if (value.status !== 'contract' && !value.reason)
			found.push(`${key}: ${value.status} without a reason`);
	};
	for (const [sample, entry] of Object.entries(manifest.samples)) {
		if (entry === 'contract') continue;
		check(sample, entry);
		for (const [variant, value] of Object.entries(entry.variants ?? {}))
			check(`${sample}/${variant}`, value);
	}
	return found;
}
