import { statSync, unlinkSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { connect } from 'node:net';
import { format } from 'node:url';
import type { Handler } from './handler.ts';
import { Environment } from './env.ts';

export function listen(handler: Handler, env: Environment, shutdownEvent: string): Server {
	const socket = env.get('SOCKET_PATH');
	const host = env.get('HOST', '0.0.0.0')!;
	const port = env.get('PORT', '3000')!;
	const pid = env.integer('LISTEN_PID', 0)!;
	const fds = env.integer('LISTEN_FDS', 0)!;
	if (pid !== 0 && pid !== process.pid)
		throw new Error(`LISTEN_PID ${pid} does not match process ${process.pid}`);
	if (fds > 1) throw new Error('Socket activation accepts only one file descriptor');
	const activation = pid === process.pid && fds === 1;
	const shutdown = env.integer('SHUTDOWN_TIMEOUT', 30)!;
	const idle = env.integer('IDLE_TIMEOUT', 0)!;
	const keepAlive = env.integer('KEEP_ALIVE_TIMEOUT');
	const headers = env.integer('HEADERS_TIMEOUT');
	let requests = 0;
	let closing = false;
	let deadline: ReturnType<typeof setTimeout> | undefined;
	let idleTimer: ReturnType<typeof setTimeout> | undefined;
	const server = createServer((request, response) => {
		requests++;
		clearTimeout(idleTimer);
		let completed = false;
		const complete = () => {
			if (completed) return;
			completed = true;
			requests--;
			if (closing) server.closeIdleConnections();
			else if (activation && idle && requests === 0)
				idleTimer = setTimeout(() => stop('IDLE'), idle * 1000);
		};
		response.once('finish', complete);
		response.once('close', complete);
		void handler(request, response, () => response.writeHead(404).end()).catch((error: unknown) => {
			console.error(error);
			if (response.headersSent) response.destroy();
			else response.writeHead(500).end('Internal Server Error');
		});
	});
	if (keepAlive !== undefined) server.keepAliveTimeout = keepAlive * 1000;
	if (headers !== undefined) server.headersTimeout = headers * 1000;
	const stop = (reason: 'SIGTERM' | 'SIGINT' | 'IDLE') => {
		if (closing) return;
		closing = true;
		clearTimeout(idleTimer);
		server.closeIdleConnections();
		deadline = setTimeout(() => server.closeAllConnections(), shutdown * 1000);
		server.close((error) => {
			clearTimeout(deadline);
			if (!error)
				(process.emit as (event: string, reason: string) => boolean)(shutdownEvent, reason);
		});
	};
	const terminate = () => stop('SIGTERM');
	const interrupt = () => stop('SIGINT');
	process.on('SIGTERM', terminate);
	process.on('SIGINT', interrupt);
	server.once('close', () => {
		clearTimeout(deadline);
		clearTimeout(idleTimer);
		process.off('SIGTERM', terminate);
		process.off('SIGINT', interrupt);
	});
	const bind = () =>
		server.listen(socket ? { path: socket } : { host, port: Number(port) }, () => {
			const address = server.address();
			const url =
				socket ??
				(address && typeof address === 'object'
					? format({ protocol: 'http:', hostname: address.address, port: address.port })
					: format({ protocol: 'http:', hostname: host, port }));
			console.log(`Listening on ${url}`);
		});
	if (activation) server.listen({ fd: 3 }, () => console.log('Listening on file descriptor 3'));
	else if (socket) clearStaleSocket(socket, bind);
	else bind();
	return server;
}

function socketInode(path: string): number | null {
	try {
		const stats = statSync(path);
		return stats.isSocket() ? stats.ino : null;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
		return null;
	}
}

function clearStaleSocket(path: string, then: () => void): void {
	const stale = socketInode(path);
	if (stale === null) return then();
	const probe = connect({ path });
	probe.once('connect', () => {
		probe.destroy();
		then();
	});
	probe.once('error', (error: NodeJS.ErrnoException) => {
		if (error.code === 'ECONNREFUSED' && socketInode(path) === stale)
			try {
				unlinkSync(path);
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
			}
		then();
	});
}
