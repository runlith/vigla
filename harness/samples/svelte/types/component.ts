import {
	type ComponentProps,
	mount,
	hydrate,
	type Component,
	type ComponentInternals
} from 'svelte';
import { render } from 'svelte/server';

// --------------------------------------------------------------------------- function component

const functionComponent: Component<
	{ binding: boolean; readonly: string },
	{ foo: 'bar' },
	'binding'
> = (a, props) => {
	props.binding === true;
	props.readonly === 'foo';
	// @ts-expect-error
	props.readonly = true;
	// @ts-expect-error
	props.binding = '';
	return {
		foo: 'bar'
	};
};
functionComponent.element === HTMLElement;

const bindingIsOkayToWiden: Component<any> = functionComponent;

functionComponent(null as any, {
	binding: true,
	// @ts-expect-error
	readonly: true
});

const functionComponentInstance = functionComponent(null as any, {
	binding: true,
	readonly: 'foo',
	// @ts-expect-error
	x: ''
});
functionComponentInstance.foo === 'bar';
// @ts-expect-error
functionComponentInstance.foo = 'foo';

const functionComponentProps: ComponentProps<typeof functionComponent> = {
	binding: true,
	readonly: 'foo',
	// @ts-expect-error
	prop: 1
};

// Test that self-typed functions are correctly inferred, too (use case: language tools has its own shape for backwards compatibility)
const functionComponentProps2: ComponentProps<(a: any, b: { a: true }) => { foo: string }> = {
	a: true
};

mount(functionComponent, {
	target: null as any as Document | Element | ShadowRoot,
	props: {
		binding: true,
		readonly: 'foo',
		// would be nice to error here, probably needs NoInfer type helper in upcoming TS 5.5
		x: ''
	}
});
mount(functionComponent, {
	target: null as any as Document | Element | ShadowRoot,
	props: {
		binding: true,
		// @ts-expect-error wrong type
		readonly: 1
	}
});
mount(
	functionComponent,
	// @ts-expect-error props missing
	{ target: null as any }
);
// if component receives no args, props can be omitted
mount(null as any as Component<{}>, { target: null as any });

hydrate(functionComponent, {
	target: null as any as Document | Element | ShadowRoot,
	props: {
		binding: true,
		readonly: 'foo',
		// would be nice to error here, probably needs NoInfer type helper in upcoming TS 5.5
		x: ''
	}
});
hydrate(functionComponent, {
	target: null as any as Document | Element | ShadowRoot,
	// @ts-expect-error missing prop
	props: {
		binding: true
	}
});
hydrate(
	functionComponent,
	// @ts-expect-error props missing
	{ target: null as any }
);
// if component receives no args, props can be omitted
hydrate(null as any as Component<{}>, { target: null as any });

render(functionComponent, {
	props: {
		binding: true,
		readonly: 'foo'
	}
});
// @ts-expect-error
render(functionComponent);
render(functionComponent, {
	// @ts-expect-error
	props: {
		binding: true
	}
});
render(functionComponent, {
	props: {
		binding: true,
		// @ts-expect-error
		readonly: 1
	}
});

// --------------------------------------------------------------------------- *.svelte components

// import from a nonexistent file to trigger the declare module '*.svelte' in ambient.d.ts
// this could show an error in the future in the editor (because language tools intercepts and knows this is an error)
// but should always pass in tsc (because it will never know about this fact)
import Foo from './doesntexist.svelte';

Foo(null as unknown as ComponentInternals, { a: true });
