import { failure } from '../../shared/diagnostics.ts';

function fail(code: string, message: string): never {
	throw failure(code, message);
}

export function orphan(rune: string): never {
	return fail(
		'effect_orphan',
		`\`${rune}\` can only be used inside an effect (e.g. during component initialisation)`
	);
}

export function teardownOrphan(): never {
	return fail('teardown_without_owner', '`onDestroy` can only be used where an owner exists');
}

export function asyncOrphan(): never {
	return fail(
		'async_derived_orphan',
		'Cannot create a `$derived(...)` with an `await` expression outside of an effect tree'
	);
}

export function referencesSelf(): never {
	return fail('derived_references_self', 'A derived value cannot reference itself recursively');
}

export function pendingOutside(): never {
	return fail(
		'effect_pending_outside_reaction',
		'`$effect.pending()` can only be called inside an effect or derived'
	);
}

export function forkDiscarded(): never {
	return fail('fork_discarded', 'Cannot commit a fork that was already discarded');
}

export function forkTiming(): never {
	return fail(
		'fork_timing',
		'Cannot create a fork inside an effect or when state changes are pending'
	);
}

export function unsafeMutation(): never {
	return fail(
		'state_unsafe_mutation',
		'Updating state inside `$derived(...)`, `$inspect(...)` or a template expression is forbidden. If the value should not be reactive, declare it without `$state`'
	);
}

export function depthExceeded(): Error {
	return failure(
		'effect_update_depth_exceeded',
		'Maximum update depth exceeded. This typically indicates that an effect reads and writes the same piece of state'
	);
}
