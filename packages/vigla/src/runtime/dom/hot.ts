import { set, state } from '../reactivity/sources.ts';
import type { Source } from '../reactivity/graph.ts';
import { get } from '../reactivity/reads.ts';
import { hydrating } from './hydration.ts';
import { render, type Mountable } from './swap.ts';

export const HMR = Symbol('hmr');

interface Replacement {
	readonly fn: Mountable;
	current: Source<Mountable>;
	update(incoming: Hot): void;
}

export type Hot = Mountable & { [HMR]: Replacement };

export function hmr(fn: Mountable): Hot {
	const wrapper = ((initial: ChildNode, props: { [key: string]: unknown }) => {
		const instance: { [key: PropertyKey]: unknown } = {};
		const anchor = hydrating ? initial : document.createTextNode('');
		if (!hydrating) initial.before(anchor);
		render(anchor, () => {
			const component = get(wrapper[HMR].current);
			return (inner: ChildNode) => {
				for (const key of Reflect.ownKeys(instance)) delete instance[key];
				const result = component(inner, props);
				if (result) Object.defineProperties(instance, Object.getOwnPropertyDescriptors(result));
			};
		});
		return instance;
	}) as Hot;
	wrapper[HMR] = {
		fn,
		current: state(fn),
		update(incoming) {
			set(wrapper[HMR].current, incoming[HMR].fn);
			incoming[HMR].current = wrapper[HMR].current;
		}
	};
	return wrapper;
}

export function cleanupStyles(hash: string): void {
	for (const style of document.querySelectorAll(`style#${hash}`)) style.remove();
}
