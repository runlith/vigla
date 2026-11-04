import { identity } from '../shared/identity.ts';
import { sequencer } from './sequence.ts';

export type {
	CaughtError,
	ClientCaughtError,
	ClientInit,
	Handle,
	HandleClientError,
	HandleFetch,
	HandleServerError,
	Reroute,
	ResolveOptions,
	ServerInit,
	Transport,
	Transporter
} from '../types/hooks.ts';

export const sequence = sequencer(identity);
