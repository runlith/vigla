import { statSync, unlinkSync } from 'node:fs';
import type { Server } from 'bun';
import type { Application } from './handler.ts';

export function listen(app: Application, shutdownEvent: string): Server<undefined> {
	if (Bun.semver.order(Bun.version, '1.4.0') < 0)
		throw new Error(`adapter-bun requires Bun 1.4 or newer; found ${Bun.version}`);
	const { env } = app;
	const defaults = app.deployment.serverOptions;
	const unix = env.get('SOCKET_PATH', defaults.unix);
	if (unix) {
		try {
			if (statSync(unix).isSocket()) unlinkSync(unix);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
		}
	}
	const shutdown = env.integer('SHUTDOWN_TIMEOUT', 30)!;
	const idleTimeout = env.integer('CONNECTION_IDLE_TIMEOUT', defaults.idleTimeout, 0, 255);
	const server = Bun.serve<undefined>({
		...(unix
			? { unix }
			: {
					hostname: env.get('HOST', defaults.hostname),
					port: env.get('PORT', defaults.port?.toString()) ?? 3000,
					reusePort: env.boolean('REUSE_PORT', defaults.reusePort),
					ipv6Only: env.boolean('IPV6_ONLY', defaults.ipv6Only),
					idleTimeout
				}),
		development: env.boolean('DEVELOPMENT', defaults.development ?? false),
		maxRequestBodySize: env.bytes('BODY_SIZE_LIMIT', defaults.maxRequestBodySize ?? 512 * 1024),
		fetch: app.fetch,
		routes: app.routes
	});
	console.log(`Listening on ${unix ?? server.url}`);
	let closing = false;
	const stop = async (reason: 'SIGTERM' | 'SIGINT') => {
		if (closing) process.exit(1);
		closing = true;
		let timer: ReturnType<typeof setTimeout> | undefined;
		const drained = await Promise.race([
			server.stop().then(() => true),
			new Promise<false>((resolve) => {
				timer = setTimeout(() => resolve(false), shutdown * 1000);
			})
		]);
		clearTimeout(timer);
		if (!drained) await server.stop(true);
		process.off('SIGTERM', terminate);
		process.off('SIGINT', interrupt);
		(process.emit as (event: string, reason: string) => boolean)(shutdownEvent, reason);
	};
	const terminate = () => {
		void stop('SIGTERM');
	};
	const interrupt = () => {
		void stop('SIGINT');
	};
	process.on('SIGTERM', terminate);
	process.on('SIGINT', interrupt);
	return server;
}
