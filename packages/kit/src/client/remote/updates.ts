import type { RemoteQueryUpdate, UpdatingPromise } from '../../types/remote.ts';
import { DEV } from 'esm-env';
import { throwCode, throwDiagnostic, warnCode, warnDiagnostic } from '../../shared/diagnostics.ts';
import type { Remotes } from './cache.ts';

export const queryId = Symbol('query.id');
export const resourceKey = Symbol('query.key');
export const overrideKey = Symbol('query.override');

interface FunctionIdentity {
	readonly [queryId]: string;
}
interface ResourceIdentity {
	readonly [resourceKey]: string;
}
interface OverrideIdentity {
	readonly [overrideKey]: string;
}

export interface Updates {
	refreshes: Set<string>;
	overrides: Array<() => void>;
}

interface Invocation {
	updates: Updates | null;
	called: boolean;
	failure?: unknown;
}

function invalidUpdate(): never {
	if (DEV)
		throwDiagnostic(
			'remote_updates_invalid_argument',
			'`updates()` expects a query or live query function, query resource, or query override',
			invalidUpdate
		);
	throwCode('remote_updates_invalid_argument');
}

function categorize(remotes: Remotes, updates: RemoteQueryUpdate[]): Updates {
	const refreshes = new Set<string>();
	const overrides: Array<() => void> = [];
	const keys = new Set<string>();
	for (const update of updates) {
		if (typeof update === 'function') {
			if (Object.hasOwn(update, queryId)) {
				const id = (update as unknown as FunctionIdentity)[queryId];
				for (const key of remotes.keys(id)) refreshes.add(key);
			} else if (Object.hasOwn(update, overrideKey)) {
				const key = (update as unknown as OverrideIdentity)[overrideKey];
				if (keys.has(key)) {
					if (DEV)
						throwDiagnostic(
							'remote_updates_duplicate_override',
							'Multiple overrides for the same query are not allowed in a single `updates()` invocation',
							categorize
						);
					throwCode('remote_updates_duplicate_override');
				}
				keys.add(key);
				refreshes.add(key);
				overrides.push(update as () => void);
			} else overrides.push(update as () => void);
		} else if (
			update !== null &&
			typeof update === 'object' &&
			Object.hasOwn(update, resourceKey)
		) {
			refreshes.add((update as unknown as ResourceIdentity)[resourceKey]);
		} else invalidUpdate();
	}
	return { refreshes, overrides };
}

export function updating<T>(
	remotes: Remotes,
	source: 'command invocation' | 'form submission',
	run: (updates: Updates | null) => Promise<T>
): UpdatingPromise<T> {
	const invocation: Invocation = { updates: null, called: false };
	const promise = (async () => {
		try {
			await Promise.resolve();
			if (invocation.failure !== undefined) throw invocation.failure;
			return await run(invocation.updates);
		} finally {
			for (const release of invocation.updates?.overrides ?? []) release();
		}
	})() as UpdatingPromise<T>;
	promise.updates = (...values) => {
		if (invocation.called) {
			if (DEV)
				warnDiagnostic(
					'remote_updates_repeated',
					`Updates can only be sent once per ${source}. Ignoring additional updates.`
				);
			else warnCode('remote_updates_repeated');
			return promise;
		}
		invocation.called = true;
		try {
			invocation.updates = categorize(remotes, values);
		} catch (error) {
			invocation.failure = error;
		}
		return promise;
	};
	return promise;
}
