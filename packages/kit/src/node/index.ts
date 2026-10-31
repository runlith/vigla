import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';

export { getRequest } from './request.ts';
export { setResponse } from './response.ts';

export function createReadableStream(file: string): ReadableStream<Uint8Array> {
	return Readable.toWeb(createReadStream(file)) as ReadableStream<Uint8Array>;
}
