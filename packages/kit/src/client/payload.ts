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

let initialized: ClientGlobal | null = null;

export function init(value: ClientPayload): ClientGlobal {
	if (initialized === value) return initialized;
	const channel = new Chunks();
	chunks = channel;
	payload = value;
	hashRouting = value.hash ?? false;
	base = value.base ?? '';
	assets = value.assets ?? base;
	appDir = value.app_dir ?? '_app';
	version = value.version ?? '';
	env = value.env ?? {};
	initialized = Object.assign(value, {
		defer: channel.defer.bind(channel),
		resolve: channel.resolve.bind(channel)
	});
	return initialized;
}
