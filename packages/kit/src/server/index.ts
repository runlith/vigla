import type { ServerInitOptions } from '../types/request.ts';
import type {
	AsyncContext,
	Environment,
	Read,
	RequestStore,
	RespondOptions,
	ServerHooks,
	ServerInstance,
	ServerManifest,
	ServerOptions
} from '../types/internal/server.ts';
import { registerContext } from './scope.ts';
import { Tracer } from './telemetry.ts';
import { respond } from './respond.ts';
import { configureEnvironment } from './environment.ts';
import { configurePaths } from './paths.ts';
import { configureRead } from './read.ts';

export class Server implements ServerInstance {
	readonly manifest: ServerManifest;
	readonly options: ServerOptions;
	readonly tracer = new Tracer();
	readonly cookiePaths = new Map<string, Set<string>>();
	environment: Environment = { public: {}, private: {}, rendered: {} };
	hooks: ServerHooks = {};
	scope?: AsyncContext;
	read?: Read;
	#configuration: Promise<void> | null = null;
	#initialization: Promise<void> | null = null;

	constructor(manifest: ServerManifest, options: ServerOptions) {
		this.manifest = manifest;
		this.options = options;
	}

	configure({ env, read, scope }: ServerInitOptions): Promise<void> {
		return (this.#configuration ??= (async () => {
			this.read = read;
			this.scope = scope;
			if (scope) registerContext(scope);
			configureEnvironment(this.options, this.environment);
			configurePaths(this.options.paths, this.manifest.app_dir);
			configureRead(this.manifest, this.options.paths, read);
			await this.setEnv(env);
		})());
	}

	async setEnv(env: Record<string, string | undefined>): Promise<void> {
		this.environment = await this.options.env.set(env);
		configureEnvironment(this.options, this.environment);
	}

	init(options: ServerInitOptions): Promise<void> {
		return (this.#initialization ??= (async () => {
			await this.configure(options);
			await this.tracer.init(this.options.tracing.server);
			this.hooks = await this.options.getHooks();
			await this.hooks.init?.();
		})());
	}

	async respond(request: Request, options: RespondOptions): Promise<Response> {
		if (!this.#initialization)
			throw new Error('Server.init() must be called before Server.respond()');
		await this.#initialization;
		return this.tracer.request(request, () => respond(this, request, options));
	}

	respondInternal(request: Request, parent: RequestStore): Promise<Response> {
		return respond(
			this,
			request,
			{
				getClientAddress: parent.event.getClientAddress,
				platform: parent.event.platform,
				emulator: parent.state.emulator,
				read: parent.state.read,
				prerendering: parent.state.prerendering
			},
			parent
		);
	}
}

export { getRequestEvent, getRequestOwner } from './scope.ts';
export { read } from './read.ts';
