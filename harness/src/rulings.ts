import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Entry, Manifest } from './manifest.ts';
import { reaches } from './scope.ts';

export const sampleRuling = '_ruling.json';
export const specRuling = '.ruling.json';

type Layout = { by: 'sample' } | { by: 'spec'; spec: RegExp; filed: boolean };

const layouts: Readonly<Record<string, Layout>> = {
	runtime: { by: 'sample' },
	browser: { by: 'sample' },
	kit: { by: 'spec', spec: /\.test\.[jt]s$/, filed: true },
	'vite-plugin': { by: 'spec', spec: /^[^/]+\.ts$/, filed: false }
};

function walk(dir: string, at = '', into: string[] = []): string[] {
	for (const entry of readdirSync(join(dir, at), { withFileTypes: true })) {
		if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
		const file = at === '' ? entry.name : `${at}/${entry.name}`;
		if (entry.isDirectory()) walk(dir, file, into);
		else into.push(file);
	}
	return into;
}

export function rulingOf(spec: string): string {
	const dot = spec.lastIndexOf('.');
	return `${dot > spec.lastIndexOf('/') ? spec.slice(0, dot) : spec}${specRuling}`;
}

export function ownManifest(
	suite: string,
	dir: string,
	legacy: string,
	repository: string
): Manifest {
	const layout = layouts[suite];
	if (layout === undefined) throw new Error(`own suite ${suite} declares no ruling layout`);
	const shown = (path: string): string => relative(repository, path);
	const samples: Record<string, Entry> = {};
	const origin = new Map<string, string>();
	const problems: string[] = [];
	const sampleOf = (key: string): string | null =>
		layout.by === 'sample' ? key : layout.filed ? (key.split(' > ')[0] ?? key) : null;
	const report = (sample: string | null, text: string): void => {
		if (sample === null || reaches(`own/${suite}`, sample)) problems.push(text);
	};
	const read = (file: string): unknown => {
		try {
			return JSON.parse(readFileSync(file, 'utf8')) as unknown;
		} catch (error) {
			problems.push(`${shown(file)}: ${(error as Error).message}`);
			return undefined;
		}
	};
	const add = (key: string, given: Entry, from: string): void => {
		const entry: Entry = given === 'contract' ? { status: 'contract' } : given;
		const before = origin.get(key);
		if (before === undefined) {
			samples[key] = entry;
			origin.set(key, from);
		} else if (canonical(samples[key]) !== canonical(entry)) {
			report(sampleOf(key), `${key}: ruled differently in ${before} and ${from}`);
		}
	};

	const files = existsSync(dir) ? walk(dir) : [];
	const names =
		layout.by === 'sample' && existsSync(dir)
			? readdirSync(dir, { withFileTypes: true })
					.filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
					.map((entry) => entry.name)
					.sort()
			: [];
	const specs = layout.by === 'spec' ? files.filter((file) => layout.spec.test(file)) : [];

	if (layout.by === 'sample') {
		for (const name of names) {
			const file = join(dir, name, sampleRuling);
			if (!existsSync(file)) continue;
			const entry = read(file);
			if (entry !== undefined) add(name, entry as Entry, shown(file));
		}
	} else {
		for (const file of files) {
			if (!file.endsWith(specRuling)) continue;
			const spec = specs.find((candidate) => rulingOf(candidate) === file);
			if (spec === undefined) {
				report(file.slice(0, -specRuling.length), `${shown(join(dir, file))}: no spec beside it`);
				continue;
			}
			const rules = read(join(dir, file));
			if (rules === undefined) continue;
			for (const [inner, entry] of Object.entries(rules as Record<string, Entry>))
				add(layout.filed ? `${spec} > ${inner}` : inner, entry, shown(join(dir, file)));
		}
	}

	if (existsSync(legacy)) {
		const old = read(legacy) as Manifest | undefined;
		for (const [key, entry] of Object.entries(old?.samples ?? {})) add(key, entry, shown(legacy));
	}

	for (const [key, from] of origin) {
		const sample = sampleOf(key);
		if (sample === null) continue;
		const present = layout.by === 'sample' ? names.includes(sample) : specs.includes(sample);
		if (!present) report(sample, `${from}: ${key} has no sample at ${shown(join(dir, sample))}`);
	}
	if (layout.by === 'sample') {
		for (const name of names)
			if (!origin.has(name)) report(name, `${shown(join(dir, name))}: no ${sampleRuling}`);
	} else {
		for (const spec of specs) {
			const ruled = layout.filed
				? [...origin.keys()].some((key) => key.startsWith(`${spec} > `))
				: files.includes(rulingOf(spec));
			if (!ruled)
				report(
					layout.filed ? spec : null,
					`${shown(join(dir, spec))}: no ${rulingOf(spec).split('/').pop()}`
				);
		}
	}
	return { samples, problems };
}

function canonical(value: unknown): string {
	return JSON.stringify(value, (_, inner: unknown) =>
		inner !== null && typeof inner === 'object' && !Array.isArray(inner)
			? Object.fromEntries(Object.entries(inner).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
			: inner
	);
}
