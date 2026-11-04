import { BuildMessages } from './messages.ts';
import type { BuildContext } from './types.ts';

export type TrackedFeatures = Map<string, string[]>;

const marker = /globalThis\.__VIGLA_TRACK__\?\.\(['"](.+?)['"]\)/g;

export function trackFeatures(code: string, file: string, tracked: TrackedFeatures): string | null {
	if (!code.includes('__VIGLA_TRACK__')) return null;
	return code.replace(marker, (_, label: string) => {
		const labels = tracked.get(file) ?? [];
		labels.push(label);
		tracked.set(file, labels);
		return `/* track ${label} */`;
	});
}

function featuresOf(context: BuildContext, tracked: TrackedFeatures, entries: string[]): string[] {
	const features = new Set<string>();
	const visited = new Set<string>();
	const visit = (file: string): void => {
		if (visited.has(file)) return;
		visited.add(file);
		for (const feature of tracked.get(file) ?? []) features.add(feature);
		for (const imported of context.artifacts.chunks[file]?.imports ?? []) visit(imported);
	};
	entries.forEach(visit);
	return [...features];
}

export function checkFeatures(context: BuildContext, tracked: TrackedFeatures): void {
	const adapter = context.config.adapter;
	if (!adapter || !tracked.size) return;
	const e = new BuildMessages(context.diagnostics);
	for (const route of context.tree.routes) {
		const metadata = context.analysis.routes.get(route.id);
		if (!metadata || metadata.prerender === true) continue;
		const files = [
			...(route.page ? [...route.page.layouts, route.page.leaf] : []).flatMap((index) => {
				const server = index === undefined ? undefined : context.artifacts.nodes[index]?.server;
				return server ? [server] : [];
			}),
			...(context.artifacts.endpoints[route.id] ? [context.artifacts.endpoints[route.id]!] : [])
		];
		if (
			featuresOf(context, tracked, files).includes('$app/server:read') &&
			!adapter.supports?.read?.({ route: { id: route.id }, config: metadata.config })
		)
			e.adapter_read_unsupported({ route: route.id, adapter: adapter.name });
	}
}
