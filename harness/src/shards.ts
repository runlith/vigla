import { treeNamed } from './trees.ts';

export interface Shard {
	index: number;
	total: number;
}

type Kind = 'step' | 'mode' | 'suite';

const startupSeconds: Readonly<Record<Kind, number>> = { step: 25, mode: 20, suite: 5 };
const entrySeconds: Readonly<Record<Kind, number>> = { step: 0.35, mode: 0.35, suite: 0.02 };

interface Unit {
	key: string;
	kind: Kind;
	entries: Map<string, string[]>;
	count: number;
}

export function parseShard(value: string): Shard {
	const match = /^(\d+)\/(\d+)$/.exec(value);
	const index = Number(match?.[1]);
	const total = Number(match?.[2]);
	if (match === null || index < 1 || index > total)
		throw new Error(`--shard takes <index>/<total> with 1 ≤ index ≤ total, not ${value}`);
	return { index, total };
}

function variantOf(entry: string): string {
	return / \(([^()]*)\)$/.exec(entry)?.[1] ?? '';
}

function placeOf(suite: string, entry: string): { key: string; kind: Kind } {
	const [project = '', name = ''] = suite.split('/');
	const tree = treeNamed(project, name);
	if (
		tree?.runner === 'kit' &&
		tree.key === 'path' &&
		!name.endsWith('units') &&
		name !== 'types'
	) {
		const step = variantOf(entry).split('/')[0];
		return { key: `${suite} ${step} ${entry.split(' > ')[0]}`, kind: 'step' };
	}
	if (tree?.runner === 'vite-plugin' && name === 'e2e')
		return { key: `${suite} ${variantOf(entry)}`, kind: 'mode' };
	return { key: suite, kind: 'suite' };
}

function cost(unit: Unit): number {
	return startupSeconds[unit.kind] + entrySeconds[unit.kind] * unit.count;
}

export function shardOf(
	scope: Readonly<Record<string, readonly string[]>>,
	shard: Shard
): { scope: Record<string, string[]>; units: number; entries: number; seconds: number } {
	const units = new Map<string, Unit>();
	for (const [suite, entries] of Object.entries(scope))
		for (const entry of entries) {
			const place = placeOf(suite, entry);
			const unit = units.get(place.key) ?? {
				key: place.key,
				kind: place.kind,
				entries: new Map(),
				count: 0
			};
			units.set(place.key, unit);
			unit.entries.set(suite, [...(unit.entries.get(suite) ?? []), entry]);
			unit.count++;
		}
	const ordered = [...units.values()].sort(
		(a, b) => cost(b) - cost(a) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)
	);
	const loads = Array.from({ length: shard.total }, () => 0);
	const mine: Unit[] = [];
	for (const unit of ordered) {
		let least = 0;
		for (let index = 1; index < loads.length; index++)
			if (loads[index]! < loads[least]!) least = index;
		loads[least]! += cost(unit);
		if (least === shard.index - 1) mine.push(unit);
	}
	const picked: Record<string, string[]> = {};
	for (const unit of mine)
		for (const [suite, entries] of unit.entries) (picked[suite] ??= []).push(...entries);
	return {
		scope: picked,
		units: mine.length,
		entries: mine.reduce((sum, unit) => sum + unit.count, 0),
		seconds: Math.round(loads[shard.index - 1]!)
	};
}
