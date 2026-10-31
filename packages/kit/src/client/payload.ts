import type { ClientGlobal, ClientPayload } from '../types/internal/client.ts';
import { Chunks } from './chunks.ts';

export let payload: ClientPayload = {};
export let chunks = new Chunks();
export let base = '';
export let assets = '';
export let appDir = '_app';
export let version = '';
export let env: Record<string, unknown> = {};
export let hashRouting = false;

export function init(value: ClientPayload): ClientGlobal {
	const channel = new Chunks();
	chunks = channel;
	payload = value;
	hashRouting = value.hash ?? false;
	base = value.base ?? '';
	assets = value.assets ?? '';
	appDir = value.app_dir ?? '_app';
	version = value.version ?? '';
	env = value.env ?? {};
	return Object.assign(value, {
		defer: channel.defer.bind(channel),
		resolve: channel.resolve.bind(channel)
	});
}
