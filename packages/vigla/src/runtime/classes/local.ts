import type { Source } from '../reactivity/graph.ts';
import { source, state } from '../reactivity/sources.ts';
import { local } from '../reactivity/tracking.ts';

export function keyed<T>(sibling: Source, value: T): Source<T> {
	return local(sibling) ? state(value) : source(value);
}
