import { existsSync, realpathSync } from 'node:fs';
import path from 'node:path';
import type { Manifest, ManifestChunk } from 'vite';
import type { FontDependency } from '../types/internal/server.ts';
import { posix } from './paths.ts';

export interface Dependencies {
	file: string;
	imports: string[];
	stylesheets: string[];
	fonts: FontDependency[];
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
	function visit(chunk: ManifestChunk, script: boolean): void {
		const key = chunk.file + ':' + script;
		if (seen.has(key)) return;
		seen.add(key);
		if (script) imports.add(chunk.file);
		chunk.css?.forEach((file) => stylesheets.add(file));
		chunk.assets?.forEach((file) => assets.add(file));
		for (const key of chunk.imports ?? []) visit(manifest[key]!, script);
		if (dynamicCss) for (const key of chunk.dynamicImports ?? []) visit(manifest[key]!, false);
	}
	visit(start, true);
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
	return { file: start.file, imports: [...imports], stylesheets: [...stylesheets], fonts };
}
