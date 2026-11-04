import type { ShallowCaller } from '../../../types/navigation.ts';
import { server_api_unavailable } from '../../../server/errors.ts';

export function shallow(caller: ShallowCaller, _url: string | URL, _state: App.PageState): never {
	return server_api_unavailable({ name: `${caller}(...)` });
}
