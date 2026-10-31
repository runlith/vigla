import { createReadStream, readdirSync, statSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { pipeline } from 'node:stream';
import { lookup } from 'mrmime';

export interface StaticInput {
	directory: string;
	pathname: string;
	request: IncomingMessage;
	response: ServerResponse;
}

interface ByteRange {
	start: number;
	end: number;
}

function range(header: string, size: number): ByteRange | false | undefined {
	const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
	if (!match || (!match[1] && !match[2])) return;
	if (!match[1]) {
		const length = Number(match[2]);
		return length === 0 || size === 0
			? false
			: { start: Math.max(0, size - length), end: size - 1 };
	}
	const start = Number(match[1]);
	const end = match[2] ? Number(match[2]) : size - 1;
	if (match[2] && end < start) return;
	if (start >= size) return false;
	return { start, end: Math.min(end, size - 1) };
}

function tags(header: string): string[] {
	const value = header.trim();
	if (value === '*') return ['*'];
	if (!/^(?:W\/)?"[^"]*"\s*(?:,\s*(?:W\/)?"[^"]*"\s*)*$/.test(value)) return [];
	return value.match(/(?:W\/)?"[^"]*"/g) ?? [];
}

function exactCase(file: string, directory: string): boolean {
	for (let current = file; current !== directory; current = path.dirname(current)) {
		const parent = path.dirname(current);
		if (parent === current || !readdirSync(parent).includes(path.basename(current))) return false;
	}
	return true;
}

export function serveFile({ directory, pathname, request, response }: StaticInput): boolean {
	if (request.method !== 'GET' && request.method !== 'HEAD') return false;
	let decoded: string;
	try {
		decoded = decodeURIComponent(pathname);
	} catch {
		return false;
	}
	if (!decoded.startsWith('/') || decoded.includes('\0')) return false;
	directory = path.resolve(directory);
	const file = path.resolve(directory, '.' + decoded);
	const relative = path.relative(directory, file);
	if (
		!relative ||
		relative === '..' ||
		relative.startsWith('..' + path.sep) ||
		path.isAbsolute(relative)
	)
		return false;
	const stat = statSync(file, { throwIfNoEntry: false });
	if (!stat?.isFile() || !exactCase(file, directory)) return false;
	const etag = `W/"${stat.size}-${stat.mtimeMs}"`;
	const modified = Math.min(Math.floor(stat.mtimeMs / 1000), Math.floor(Date.now() / 1000));
	const lastModified = new Date(modified * 1000).toUTCString();
	response.setHeader('etag', etag);
	response.setHeader('last-modified', lastModified);
	response.setHeader('accept-ranges', 'bytes');
	if (!response.hasHeader('cache-control')) response.setHeader('cache-control', 'no-cache');
	const type = lookup(file);
	if (type && !response.hasHeader('content-type'))
		response.setHeader('content-type', type === 'text/html' ? type + '; charset=utf-8' : type);
	const match = request.headers['if-match'];
	const unmodified = request.headers['if-unmodified-since'];
	if (
		(match !== undefined && !tags(match).includes('*')) ||
		(match === undefined && unmodified !== undefined && modified > Date.parse(unmodified) / 1000)
	) {
		response.writeHead(412);
		response.end();
		return true;
	}
	const none = request.headers['if-none-match'];
	const since = request.headers['if-modified-since'];
	const unchanged =
		none !== undefined
			? tags(none).some((tag) => tag === '*' || tag.replace(/^W\//, '') === etag.slice(2))
			: since !== undefined && modified <= Date.parse(since) / 1000;
	if (unchanged) {
		response.writeHead(304);
		response.end();
		return true;
	}
	const ifRange = request.headers['if-range'];
	const canRange =
		ifRange === undefined ||
		(ifRange === lastModified && modified <= Math.floor(Date.now() / 1000) - 60);
	const selected =
		request.method === 'GET' && canRange && request.headers.range
			? range(request.headers.range, stat.size)
			: undefined;
	if (selected === false) {
		response.writeHead(416, { 'content-range': `bytes */${stat.size}`, 'content-length': 0 });
		response.end();
		return true;
	}
	if (selected)
		response.setHeader('content-range', `bytes ${selected.start}-${selected.end}/${stat.size}`);
	response.setHeader('content-length', selected ? selected.end - selected.start + 1 : stat.size);
	response.writeHead(selected ? 206 : 200);
	if (request.method === 'HEAD') response.end();
	else pipeline(createReadStream(file, selected), response, () => {});
	return true;
}
