import type { ParamValue } from '../types/params.ts';
import type { RequestEvent } from '../types/request.ts';

export function appEvent(event: RequestEvent<Record<string, ParamValue>>): RequestEvent {
	return event as RequestEvent;
}
