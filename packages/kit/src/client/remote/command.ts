import { cell, untrack } from 'vigla';
import { DEV } from 'esm-env';
import type { RemoteCommand, UpdatingPromise } from '../../types/remote.ts';
import { encodeCommand } from '../../shared/remote.ts';
import { throwCode, throwDiagnostic } from '../../shared/diagnostics.ts';
import { client } from '../client.ts';
import type { Remotes } from './cache.ts';
import { updating } from './updates.ts';

export class Command {
	readonly #remote: Remotes;
	readonly #id: string;
	readonly #pending = cell(0);

	constructor(remote: Remotes, id: string) {
		this.#remote = remote;
		this.#id = id;
	}

	get pending(): number {
		return this.#pending.current;
	}

	invoke(argument: unknown): UpdatingPromise<any> {
		const remote = this.#remote;
		const headers = { 'Content-Type': 'application/json', ...remote.channel.headers() };
		untrack(() => {
			this.#pending.current++;
		});
		const promise = updating(remote, 'command invocation', async (updates) => {
			const payload = await remote.owner.run(() =>
				encodeCommand(argument, remote.client.app.hooks.transport)
			);
			const result = await remote.channel.request(
				remote.channel.url(this.#id),
				{
					method: 'POST',
					headers,
					body: JSON.stringify({ payload, refreshes: [...(updates?.refreshes ?? [])] })
				},
				updates?.refreshes
			);
			if (result.redirect) {
				if (DEV)
					throwDiagnostic(
						'remote_command_redirect',
						'Redirects are not allowed in commands. Return a result instead and use `goto` on the client',
						this.invoke
					);
				throwCode('remote_command_redirect');
			}
			remote.failMissing(updates?.refreshes);
			return result._;
		});
		void promise
			.finally(() => {
				this.#pending.current--;
			})
			.catch(() => {});
		return promise;
	}
}

export function command<Input = any, Output = any>(id: string): RemoteCommand<Input, Output> {
	const fn = (argument: unknown) => client('command').remote.command(id).invoke(argument);
	Object.defineProperty(fn, 'pending', { get: () => client('command').remote.command(id).pending });
	return fn as RemoteCommand<Input, Output>;
}
