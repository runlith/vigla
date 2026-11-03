import { createLog, type Log } from './log.ts';

export interface Identity {
	readonly name: string;
	readonly log: Log;
}

export function createIdentity(name: string): Identity {
	return { name, log: createLog(name) };
}
