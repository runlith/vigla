import { existsSync, realpathSync } from 'node:fs';
import path from 'node:path';
import type { Manifest, ManifestChunk } from 'vite';
import type { FontDependency } from '../types/internal/server.ts';
import { posix } from './paths.ts';

export interface Resources {
	stylesheets: Set<string>;
	fonts: Set<string>;
}

export interface Dependencies {
	file: string;
	source: string;
	imports: string[];
	stylesheets: string[];
	fonts: FontDependency[];
	bySource: Map<string, Resources>;
}

export function entry(manifest: Manifest, id: string, root: string): ManifestChunk {
	const absolute = existsSync(id) ? realpathSync(id) : id;
	const relative = posix(path.relative(root, absolute));
	const found =
		manifest[id] ??
		manifest[relative] ??
		Object.values(manifest).find(
			(chunk) => chunk.src && posix(path.resolve(root, chunk.src)) === posix(absolute)
		);
	if (!found) throw new Error(`Cannot find built entry ${id} in Vite's manifest`);
	return found;
}

export function dependencies(
	manifest: Manifest,
	id: string,
	root: string,
	dynamicCss: boolean
): Dependencies {
	const start = entry(manifest, id, root);
	const imports = new Set<string>();
	const stylesheets = new Set<string>();
	const assets = new Set<string>();
	const seen = new Set<string>();
	const bySource = new Map<string, Resources>();
	const sourceId = (file: string): string => {
		if (file.startsWith('\0')) return file;
		const absolute = path.resolve(root, file);
		return posix(existsSync(absolute) ? realpathSync(absolute) : absolute);
	};
	const source = sourceId(id);
	function visit(chunk: ManifestChunk, script: boolean, owner: string, depth: number): void {
		const key = JSON.stringify([chunk.file, script, owner, depth]);
		if (seen.has(key)) return;
		seen.add(key);
		if (script) imports.add(chunk.file);
		chunk.css?.forEach((file) => stylesheets.add(file));
		chunk.assets?.forEach((file) => assets.add(file));
		if (depth <= 1 && (chunk.css?.length || chunk.assets?.length)) {
			let resources = bySource.get(owner);
			if (!resources) {
				resources = { stylesheets: new Set(), fonts: new Set() };
				bySource.set(owner, resources);
			}
			for (const file of chunk.css ?? []) resources.stylesheets.add(file);
			for (const file of chunk.assets ?? [])
				if (/\.(woff2?|ttf|otf)$/.test(file)) resources.fonts.add(file);
		}
		for (const key of chunk.imports ?? []) visit(manifest[key]!, script, owner, depth);
		if (dynamicCss)
			for (const key of chunk.dynamicImports ?? [])
				visit(manifest[key]!, false, sourceId(key), Math.min(depth + 1, 2));
	}
	visit(start, true, source, 0);
	const fonts = [...assets]
		.filter((file) => /\.(woff2?|ttf|otf)$/.test(file))
		.map((file) => {
			const source =
				Object.entries(manifest)
					.sort(([a], [b]) => a.localeCompare(b))
					.find(([, chunk]) => chunk.file === file && chunk.src)?.[1].src ?? file;
			let filename = posix(path.relative(root, path.resolve(root, source)));
			const marker = '/node_modules/';
			const at = source.lastIndexOf(marker);
			if (at !== -1) {
				const local = 'node_modules/' + source.slice(at + marker.length);
				if (
					existsSync(path.resolve(root, local)) &&
					existsSync(path.resolve(root, source)) &&
					realpathSync(path.resolve(root, local)) === realpathSync(path.resolve(root, source))
				)
					filename = local;
			}
			return { file, filename };
		});
	return {
		file: start.file,
		source,
		imports: [...imports],
		stylesheets: [...stylesheets],
		fonts,
		bySource
	};
}
