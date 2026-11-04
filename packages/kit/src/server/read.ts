import type { Read, ServerManifest, ServerPaths } from '../types/internal/server.ts';
import { findRequest } from './scope.ts';
import * as errors from './errors.ts';

interface Assets {
	manifest: ServerManifest;
	paths: ServerPaths;
	read?: Read;
}
let configured: Assets | undefined;
export function configureRead(manifest: ServerManifest, paths: ServerPaths, read?: Read): void {
	configured = { manifest, paths, read };
}

export function read(file: string): Response {
	(globalThis as { __VIGLA_TRACK__?: (label: string) => void }).__VIGLA_TRACK__?.(
		'$app/server:read'
	);
	const store = findRequest();
	const source = store
		? { manifest: store.manifest, paths: store.options.paths, read: store.state.read }
		: configured;
	if (!source?.read) errors.read_implementation_missing();
	const inline = /^data:([^;,]+)?(;base64)?,/.exec(file);
	if (inline) {
		const encoded = file.slice(inline[0].length);
		const value = inline[2]
			? Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0))
			: new TextEncoder().encode(decodeURIComponent(encoded));
		return new Response(value, {
			headers: {
				'content-type': inline[1] || 'application/octet-stream',
				'content-length': String(value.byteLength)
			}
		});
	}
	let pathname: string;
	try {
		pathname = decodeURIComponent(new URL(file, store?.event.url ?? 'http://kit.invalid').pathname);
	} catch {
		return errors.read_asset_missing({ file });
	}
	const prefix = source.paths.assets || source.paths.base;
	const name = pathname.startsWith(`${prefix}/@fs/`)
		? pathname.slice(prefix.length)
		: pathname.startsWith(`${prefix}/`)
			? pathname.slice(prefix.length + 1)
			: pathname.slice(1);
	if (!(name in source.manifest.server_assets)) errors.read_asset_missing({ file });
	const reader = source.read;
	const pending = Promise.resolve(reader(name)).then((stream) => {
		if (!stream) errors.read_asset_missing({ file });
		return stream.getReader();
	});
	pending.catch(() => {});
	const body = new ReadableStream<Uint8Array>(
		{
			async pull(controller) {
				try {
					const next = await (await pending).read();
					if (next.done) controller.close();
					else controller.enqueue(next.value);
				} catch (error) {
					controller.error(error);
				}
			},
			async cancel(reason) {
				await (await pending).cancel(reason);
			}
		},
		{ highWaterMark: 0 }
	);
	const type = source.manifest.mime_types[name.slice(name.lastIndexOf('.'))];
	return new Response(body, {
		headers: {
			'content-length': String(source.manifest.server_assets[name]),
			...(type ? { 'content-type': type } : {})
		}
	});
}
