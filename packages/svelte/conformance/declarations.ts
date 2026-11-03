import type * as Svelte from 'svelte';
import type * as Action from 'svelte/action';
import type * as Animate from 'svelte/animate';
import type * as Attachments from 'svelte/attachments';
import type * as Compiler from 'svelte/compiler';
import type * as Easing from 'svelte/easing';
import type * as Events from 'svelte/events';
import type * as Motion from 'svelte/motion';
import type * as Reactivity from 'svelte/reactivity';
import type * as Window from 'svelte/reactivity/window';
import type * as Server from 'svelte/server';
import type * as Store from 'svelte/store';
import type * as Transition from 'svelte/transition';
import type * as client from '../src/entries/index.ts';
import type * as server from '../src/entries/index-server.ts';
import type * as action from '../src/entries/action.ts';
import type * as animate from '../src/entries/animate.ts';
import type * as attachments from '../src/entries/attachments.ts';
import type * as compiler from '../src/compiler/index.ts';
import type * as easing from '../src/entries/easing.ts';
import type * as events from '../src/entries/events.ts';
import type * as motionClient from '../src/entries/motion.ts';
import type * as motionServer from '../src/entries/motion-server.ts';
import type * as reactivityClient from '../src/entries/reactivity.ts';
import type * as reactivityServer from '../src/entries/reactivity-server.ts';
import type * as windowClient from '../src/entries/window.ts';
import type * as windowServer from '../src/entries/window-server.ts';
import type * as render from '../src/entries/server.ts';
import type * as storeClient from '../src/entries/store-client.ts';
import type * as storeServer from '../src/entries/store-server.ts';
import type * as transition from '../src/entries/transition.ts';

type Missing<Declared, Runtime> = Exclude<keyof Declared, keyof Runtime>;

type Unfit<Declared, Runtime> = {
	[K in keyof Declared & keyof Runtime]: Runtime[K] extends Declared[K] ? never : K;
}[keyof Declared & keyof Runtime];

type Holds<T extends never> = T;

type Shaped = 'mount' | 'hydrate' | 'createRawSnippet' | 'render' | 'crossfade';

export type Values = [
	Holds<Missing<typeof Svelte, typeof client>>,
	Holds<Missing<typeof Svelte, typeof server>>,
	Holds<Missing<typeof Animate, typeof animate>>,
	Holds<Missing<typeof Attachments, typeof attachments>>,
	Holds<Missing<typeof Compiler, typeof compiler>>,
	Holds<Missing<typeof Easing, typeof easing>>,
	Holds<Missing<typeof Events, typeof events>>,
	Holds<Missing<typeof Motion, typeof motionClient>>,
	Holds<Missing<typeof Motion, typeof motionServer>>,
	Holds<Missing<typeof Reactivity, typeof reactivityClient>>,
	Holds<Missing<typeof Reactivity, typeof reactivityServer>>,
	Holds<Missing<typeof Window, typeof windowClient>>,
	Holds<Missing<typeof Window, typeof windowServer>>,
	Holds<Missing<typeof Server, typeof render>>,
	Holds<Missing<typeof Store, typeof storeClient>>,
	Holds<Missing<typeof Store, typeof storeServer>>,
	Holds<Missing<typeof Transition, typeof transition>>
];

export type Signatures = [
	Holds<Exclude<Unfit<typeof Svelte, typeof client>, Shaped>>,
	Holds<Exclude<Unfit<typeof Svelte, typeof server>, Shaped>>,
	Holds<Exclude<Unfit<typeof Animate, typeof animate>, Shaped>>,
	Holds<Exclude<Unfit<typeof Attachments, typeof attachments>, Shaped>>,
	Holds<Exclude<Unfit<typeof Easing, typeof easing>, Shaped>>,
	Holds<Exclude<Unfit<typeof Events, typeof events>, Shaped>>,
	Holds<Exclude<Unfit<typeof Motion, typeof motionClient>, Shaped>>,
	Holds<Exclude<Unfit<typeof Motion, typeof motionServer>, Shaped>>,
	Holds<Exclude<Unfit<typeof Reactivity, typeof reactivityClient>, Shaped>>,
	Holds<Exclude<Unfit<typeof Reactivity, typeof reactivityServer>, Shaped | 'SvelteMap'>>,
	Holds<Exclude<Unfit<typeof Window, typeof windowClient>, Shaped>>,
	Holds<Exclude<Unfit<typeof Window, typeof windowServer>, Shaped>>,
	Holds<Exclude<Unfit<typeof Server, typeof render>, Shaped>>,
	Holds<Exclude<Unfit<typeof Store, typeof storeClient>, Shaped>>,
	Holds<Exclude<Unfit<typeof Store, typeof storeServer>, Shaped>>,
	Holds<Exclude<Unfit<typeof Transition, typeof transition>, Shaped>>
];

export type Options = [
	Holds<Missing<Compiler.CompileOptions, compiler.CompileOptions>>,
	Holds<Missing<Compiler.ModuleCompileOptions, compiler.ModuleCompileOptions>>,
	Holds<Missing<Action.ActionReturn, action.ActionReturn>>
];
