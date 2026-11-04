import type { ActionResult, Enhancement, SubmitFunction } from '../../../types/forms.ts';
import { deserialize as decode } from '../../../shared/serialization.ts';
import { findRequest } from '../../../server/scope.ts';
import { appTransport } from '../../../server/transport.ts';
import { server_api_unavailable } from '../../../server/errors.ts';

export function deserialize(result: string): ActionResult {
	const parsed = JSON.parse(result);
	if ((parsed.type === 'success' || parsed.type === 'failure') && parsed.data)
		parsed.data = decode(parsed.data, findRequest()?.hooks.transport ?? appTransport());
	return parsed;
}
export function enhance<
	Success extends Record<string, unknown> | undefined,
	Failure extends Record<string, unknown> | undefined
>(_form: HTMLFormElement, _submit?: SubmitFunction<Success, Failure>): Enhancement {
	return { destroy() {} };
}
export function applyAction(_result: ActionResult): never {
	return server_api_unavailable({ name: 'applyAction(...)' });
}
