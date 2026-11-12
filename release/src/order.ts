import { siblings } from './manifest.ts';
import type { Package } from './pack.ts';

export function ordered(packages: Package[]): Package[] {
	const byName = new Map(packages.map((item) => [item.manifest.name, item]));
	const open = new Set<string>();
	const placed = new Set<string>();
	const result: Package[] = [];
	const place = (item: Package): void => {
		const { name } = item.manifest;
		if (placed.has(name)) return;
		if (open.has(name)) throw new Error(`${name} depends on itself through its siblings`);
		open.add(name);
		for (const dependency of siblings(item.manifest)) {
			const found = byName.get(dependency);
			if (found) place(found);
		}
		placed.add(name);
		result.push(item);
	};
	for (const item of packages) place(item);
	return result;
}

export function withDependents(packages: Package[], names: Iterable<string>): Set<string> {
	const reached = new Set(names);
	for (let grown = true; grown;) {
		grown = false;
		for (const item of packages) {
			if (reached.has(item.manifest.name)) continue;
			if (!siblings(item.manifest).some((name) => reached.has(name))) continue;
			reached.add(item.manifest.name);
			grown = true;
		}
	}
	return reached;
}
