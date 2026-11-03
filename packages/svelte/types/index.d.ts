declare module 'svelte' {
	const internals: unique symbol;
	const rendered: unique symbol;

	export type ComponentInternals = { readonly [internals]: 'ComponentInternals' };

	export interface Component<
		Props extends Record<string, any> = {},
		Exports extends Record<string, any> = {},
		Bindings extends keyof Props | '' = string
	> {
		(
			this: void,
			internals: ComponentInternals,
			props: Props
		): Exports & {
			$on?(type: string, callback: (event: any) => void): () => void;
			$set?(props: Partial<Props>): void;
		};
		element?: typeof HTMLElement;
		z_$$bindings?: Bindings;
	}

	export interface ComponentConstructorOptions<
		Props extends Record<string, any> = Record<string, any>
	> {
		target: Document | Element | ShadowRoot;
		anchor?: Element;
		props?: Props;
		context?: Map<any, any>;
		hydrate?: boolean;
		intro?: boolean;
		recover?: boolean;
		sync?: boolean;
		idPrefix?: string;
		$$inline?: boolean;
		transformError?: (error: unknown) => unknown;
	}

	export interface SvelteComponent<
		Props extends Record<string, any> = Record<string, any>,
		Events extends Record<string, any> = any,
		Slots extends Record<string, any> = any
	> {
		[prop: string]: any;
		$$prop_def: Props;
		$$events_def: Events;
		$$slot_def: Slots;
		$$bindings?: string;
		$destroy(): void;
		$on<K extends Extract<keyof Events, string>>(
			type: K,
			callback: (event: Events[K]) => void
		): () => void;
		$set(props: Partial<Props>): void;
	}

	export type ComponentType<Comp extends SvelteComponent = SvelteComponent> = (new (
		options: ComponentConstructorOptions<
			Comp extends SvelteComponent<infer Props> ? Props : Record<string, any>
		>
	) => Comp) & { element?: typeof HTMLElement };

	export type ComponentProps<Comp extends SvelteComponent | Component<any, any>> =
		Comp extends SvelteComponent<infer Props>
			? Props
			: Comp extends Component<infer Props, any>
				? Props
				: never;

	export type ComponentEvents<Comp extends SvelteComponent> =
		Comp extends SvelteComponent<any, infer Events> ? Events : never;

	export interface Snippet<Parameters extends unknown[] = []> {
		(
			this: void,
			...args: number extends Parameters['length'] ? never : Parameters
		): { readonly [rendered]: 'Snippet' };
	}

	type Getters<Values extends unknown[]> = { [Key in keyof Values]: () => Values[Key] };

	type NotFunction<T> = T extends Function ? never : T;

	type Target = Document | Element | ShadowRoot;

	type PropsOption<Props> = {} extends Props ? { props?: Props } : { props: Props };

	export type MountOptions<Props extends Record<string, any> = Record<string, any>> = {
		target: Target;
		anchor?: Node;
		context?: Map<any, any>;
		intro?: boolean;
		transformError?: (error: unknown) => unknown | Promise<unknown>;
	} & PropsOption<Props>;

	export type HydrateOptions<Props extends Record<string, any> = Record<string, any>> = {
		target: Target;
		context?: Map<any, any>;
		intro?: boolean;
		recover?: boolean;
		transformError?: (error: unknown) => unknown;
	} & PropsOption<Props>;

	export interface Fork {
		commit(): Promise<void>;
		discard(): void;
	}

	export function mount<Props extends Record<string, any>, Exports extends Record<string, any>>(
		component: Component<Props, Exports, any>,
		options: MountOptions<Props>
	): Exports;
	export function hydrate<Props extends Record<string, any>, Exports extends Record<string, any>>(
		component: Component<Props, Exports, any>,
		options: HydrateOptions<Props>
	): Exports;
	export function unmount(
		component: Record<string, any>,
		options?: { outro?: boolean } | undefined
	): Promise<void>;

	export function onMount<T>(
		fn: () => NotFunction<T> | Promise<NotFunction<T>> | (() => any)
	): void;
	export function onDestroy(fn: () => any): void;

	export function createContext<T>(): [get: () => T, set: (context: T) => T, has: () => boolean];
	export function getContext<T>(key: any): T;
	export function setContext<T>(key: any, context: T): T;
	export function hasContext(key: any): boolean;
	export function getAllContexts<T extends Map<any, any> = Map<any, any>>(): T;

	export function createRawSnippet<Params extends unknown[]>(
		fn: (...params: Getters<Params>) => {
			render: () => string;
			setup?: (element: Element) => void | (() => void);
		}
	): Snippet<Params>;

	export function hydratable<T>(key: string, fn: () => T): T;
	export function getAbortSignal(): AbortSignal;
	export function flushSync<T = void>(fn?: (() => T) | undefined): T;
	export function fork(fn: () => void): Fork;
	export function tick(): Promise<void>;
	export function settled(): Promise<void>;
	export function untrack<T>(fn: () => T): T;

	export {};
}

declare module 'svelte/action' {
	export interface ActionReturn<
		Parameter = undefined,
		Attributes extends Record<string, any> = Record<never, any>
	> {
		update?: (parameter: Parameter) => void;
		destroy?: () => void;
		$$_attributes?: Attributes;
	}

	export interface Action<
		Element = HTMLElement,
		Parameter = undefined,
		Attributes extends Record<string, any> = Record<never, any>
	> {
		<Node extends Element>(
			...args: undefined extends Parameter
				? [node: Node, parameter?: Parameter]
				: [node: Node, parameter: Parameter]
		): void | ActionReturn<Parameter, Attributes>;
	}

	export {};
}

declare module 'svelte/attachments' {
	import type { Action, ActionReturn } from 'svelte/action';

	export interface Attachment<T extends EventTarget = Element> {
		(element: T): void | (() => void);
	}

	export function createAttachmentKey(): symbol;
	export function fromAction<E extends EventTarget, T extends unknown>(
		action: Action<E, T> | ((element: E, parameter: T) => void | ActionReturn<T>),
		fn: () => T
	): Attachment<E>;
	export function fromAction<E extends EventTarget>(
		action: Action<E, void> | ((element: E) => void | ActionReturn<void>)
	): Attachment<E>;

	export {};
}

declare module 'svelte/easing' {
	type Easing = (t: number) => number;

	export const linear: Easing;
	export const backIn: Easing;
	export const backOut: Easing;
	export const backInOut: Easing;
	export const bounceIn: Easing;
	export const bounceOut: Easing;
	export const bounceInOut: Easing;
	export const circIn: Easing;
	export const circOut: Easing;
	export const circInOut: Easing;
	export const cubicIn: Easing;
	export const cubicOut: Easing;
	export const cubicInOut: Easing;
	export const elasticIn: Easing;
	export const elasticOut: Easing;
	export const elasticInOut: Easing;
	export const expoIn: Easing;
	export const expoOut: Easing;
	export const expoInOut: Easing;
	export const quadIn: Easing;
	export const quadOut: Easing;
	export const quadInOut: Easing;
	export const quartIn: Easing;
	export const quartOut: Easing;
	export const quartInOut: Easing;
	export const quintIn: Easing;
	export const quintOut: Easing;
	export const quintInOut: Easing;
	export const sineIn: Easing;
	export const sineOut: Easing;
	export const sineInOut: Easing;

	export {};
}

declare module 'svelte/transition' {
	export type EasingFunction = (t: number) => number;

	export interface TransitionConfig {
		delay?: number;
		duration?: number;
		easing?: EasingFunction;
		css?: (t: number, u: number) => string;
		tick?: (t: number, u: number) => void;
	}

	interface Timing {
		delay?: number;
		duration?: number;
		easing?: EasingFunction;
	}

	export interface FadeParams extends Timing {}

	export interface BlurParams extends Timing {
		amount?: number | string;
		opacity?: number;
	}

	export interface FlyParams extends Timing {
		x?: number | string;
		y?: number | string;
		opacity?: number;
	}

	export interface SlideParams extends Timing {
		axis?: 'x' | 'y';
	}

	export interface ScaleParams extends Timing {
		start?: number;
		opacity?: number;
	}

	export interface DrawParams {
		delay?: number;
		speed?: number;
		duration?: number | ((length: number) => number);
		easing?: EasingFunction;
	}

	export interface CrossfadeParams {
		delay?: number;
		duration?: number | ((distance: number) => number);
		easing?: EasingFunction;
	}

	type Crossfading = (node: any, params: CrossfadeParams & { key: any }) => () => TransitionConfig;

	export function fade(node: Element, params?: FadeParams | undefined): TransitionConfig;
	export function blur(node: Element, params?: BlurParams | undefined): TransitionConfig;
	export function fly(node: Element, params?: FlyParams | undefined): TransitionConfig;
	export function slide(node: Element, params?: SlideParams | undefined): TransitionConfig;
	export function scale(node: Element, params?: ScaleParams | undefined): TransitionConfig;
	export function draw(
		node: SVGElement & { getTotalLength(): number },
		params?: DrawParams | undefined
	): TransitionConfig;
	export function crossfade(
		params: CrossfadeParams & {
			fallback?: (node: Element, params: CrossfadeParams, intro: boolean) => TransitionConfig;
		}
	): [send: Crossfading, receive: Crossfading];

	export {};
}

declare module 'svelte/animate' {
	export interface AnimationConfig {
		delay?: number;
		duration?: number;
		easing?: (t: number) => number;
		css?: (t: number, u: number) => string;
		tick?: (t: number, u: number) => void;
	}

	export interface FlipParams {
		delay?: number;
		duration?: number | ((distance: number) => number);
		easing?: (t: number) => number;
	}

	export function flip(
		node: Element,
		positions: { from: DOMRect; to: DOMRect },
		params?: FlipParams
	): AnimationConfig;

	export {};
}

declare module 'svelte/events' {
	type Handler<Target, E> = (this: Target, event: E & { currentTarget: Target }) => any;

	export function on<Type extends keyof WindowEventMap>(
		window: Window,
		type: Type,
		handler: Handler<Window, WindowEventMap[Type]>,
		options?: AddEventListenerOptions | undefined
	): () => void;
	export function on<Type extends keyof DocumentEventMap>(
		document: Document,
		type: Type,
		handler: Handler<Document, DocumentEventMap[Type]>,
		options?: AddEventListenerOptions | undefined
	): () => void;
	export function on<Element extends HTMLElement, Type extends keyof HTMLElementEventMap>(
		element: Element,
		type: Type,
		handler: Handler<Element, HTMLElementEventMap[Type]>,
		options?: AddEventListenerOptions | undefined
	): () => void;
	export function on<Element extends MediaQueryList, Type extends keyof MediaQueryListEventMap>(
		element: Element,
		type: Type,
		handler: Handler<Element, MediaQueryListEventMap[Type]>,
		options?: AddEventListenerOptions | undefined
	): () => void;
	export function on(
		element: EventTarget,
		type: string,
		handler: EventListener,
		options?: AddEventListenerOptions | undefined
	): () => void;

	export {};
}

declare module 'svelte/reactivity' {
	class Subscribed<T> {
		constructor(read: () => T, subscribe: (update: () => void) => void);
		get current(): T;
	}

	export class SvelteDate extends Date {
		constructor(...params: any[]);
	}

	export class SvelteSet<T> extends Set<T> {
		constructor(value?: Iterable<T> | null | undefined);
		add(value: T): this;
	}

	export class SvelteMap<K, V> extends Map<K, V> {
		constructor(value?: Iterable<readonly [K, V]> | null | undefined);
		getOrInsert(key: K, value: V): V;
		getOrInsertComputed(key: K, callbackFn: (key: K) => V): V;
		set(key: K, value: V): this;
	}

	export class SvelteURLSearchParams extends URLSearchParams {}

	export class SvelteURL extends URL {
		get searchParams(): SvelteURLSearchParams;
	}

	export class MediaQuery extends Subscribed<boolean> {
		constructor(query: string, fallback?: boolean | undefined);
	}

	export function createSubscriber(start: (update: () => void) => (() => void) | void): () => void;

	export {};
}

declare module 'svelte/reactivity/window' {
	interface Reading<T> {
		get current(): T;
	}

	export const scrollX: Reading<number | undefined>;
	export const scrollY: Reading<number | undefined>;
	export const innerWidth: Reading<number | undefined>;
	export const innerHeight: Reading<number | undefined>;
	export const outerWidth: Reading<number | undefined>;
	export const outerHeight: Reading<number | undefined>;
	export const screenLeft: Reading<number | undefined>;
	export const screenTop: Reading<number | undefined>;
	export const online: Reading<boolean | undefined>;
	export const devicePixelRatio: Reading<number | undefined>;

	export {};
}

declare module 'svelte/motion' {
	import type { MediaQuery } from 'svelte/reactivity';

	export interface SpringOptions {
		stiffness?: number;
		damping?: number;
		precision?: number;
	}

	export interface SpringUpdateOptions {
		instant?: boolean;
		preserveMomentum?: number;
	}

	export type Updater<T> = (target_value: T, value: T) => T;

	export interface TweenOptions<T> {
		delay?: number;
		duration?: number | ((from: T, to: T) => number);
		easing?: (t: number) => number;
		interpolate?: (from: T, to: T) => (t: number) => T;
	}

	export class Spring<T> {
		constructor(value: T, options?: SpringOptions);
		static of<U>(fn: () => U, options?: SpringOptions): Spring<U>;
		set(value: T, options?: SpringUpdateOptions): Promise<void>;
		get current(): T;
		target: T;
		stiffness: number;
		damping: number;
		precision: number;
	}

	export class Tween<T> {
		constructor(value: T, options?: TweenOptions<T>);
		static of<U>(fn: () => U, options?: TweenOptions<U> | undefined): Tween<U>;
		set(value: T, options?: TweenOptions<T> | undefined): Promise<void>;
		get current(): T;
		target: T;
	}

	export const prefersReducedMotion: MediaQuery;

	export {};
}

declare module 'svelte/store' {
	export type Subscriber<T> = (value: T) => void;
	export type Unsubscriber = () => void;
	export type Updater<T> = (value: T) => T;
	export type StartStopNotifier<T> = (
		set: (value: T) => void,
		update: (fn: Updater<T>) => void
	) => void | (() => void);

	export interface Readable<T> {
		subscribe(this: void, run: Subscriber<T>, invalidate?: () => void): Unsubscriber;
	}

	export interface Writable<T> extends Readable<T> {
		set(this: void, value: T): void;
		update(this: void, updater: Updater<T>): void;
	}

	type Stores = Readable<any> | [Readable<any>, ...Array<Readable<any>>] | Array<Readable<any>>;

	type StoresValues<T> =
		T extends Readable<infer U>
			? U
			: { [K in keyof T]: T[K] extends Readable<infer U> ? U : never };

	export function readable<T>(
		value?: T | undefined,
		start?: StartStopNotifier<T> | undefined
	): Readable<T>;
	export function writable<T>(
		value?: T | undefined,
		start?: StartStopNotifier<T> | undefined
	): Writable<T>;
	export function derived<S extends Stores, T>(
		stores: S,
		fn: (
			values: StoresValues<S>,
			set: (value: T) => void,
			update: (fn: Updater<T>) => void
		) => Unsubscriber | void,
		initial_value?: T | undefined
	): Readable<T>;
	export function derived<S extends Stores, T>(
		stores: S,
		fn: (values: StoresValues<S>) => T,
		initial_value?: T | undefined
	): Readable<T>;
	export function readonly<T>(store: Readable<T>): Readable<T>;
	export function get<T>(store: Readable<T>): T;
	export function toStore<V>(get: () => V, set: (v: V) => void): Writable<V>;
	export function toStore<V>(get: () => V): Readable<V>;
	export function fromStore<V>(store: Writable<V>): { current: V };
	export function fromStore<V>(store: Readable<V>): { readonly current: V };

	export {};
}

declare module 'svelte/server' {
	import type { Component, ComponentProps } from 'svelte';

	export type Csp = { nonce?: string; hash?: boolean };

	export type Sha256Source = `sha256-${string}`;

	export interface SyncRenderOutput {
		head: string;
		html: string;
		body: string;
		hashes: { script: Sha256Source[] };
	}

	export type RenderOutput = SyncRenderOutput & PromiseLike<SyncRenderOutput>;

	type RenderOptions<Props> = {
		context?: Map<any, any>;
		idPrefix?: string;
		csp?: Csp;
		transformError?: (error: unknown) => unknown | Promise<unknown>;
	} & ({} extends Props ? { props?: Props } : { props: Props });

	export function render<
		Comp extends Component<any>,
		Props extends ComponentProps<Comp> = ComponentProps<Comp>
	>(
		...args: {} extends Props
			? [component: Comp, options?: RenderOptions<Omit<Props, '$$slots' | '$$events'>>]
			: [component: Comp, options: RenderOptions<Omit<Props, '$$slots' | '$$events'>>]
	): RenderOutput;

	export {};
}

declare module 'svelte/compiler' {
	export const VERSION: string;

	export interface Location {
		line: number;
		column: number;
		character: number;
	}

	interface Diagnostic {
		code: string;
		message: string;
		stack?: string;
		filename?: string;
		start?: Location;
		end?: Location;
		position?: [number, number];
		frame?: string;
	}

	export interface Warning extends Diagnostic {}

	export interface CompileError extends Diagnostic {}

	export interface SourceMap {
		version: number;
		file?: string;
		sources: string[];
		sourcesContent?: Array<string | null>;
		names: string[];
		mappings: string;
		toString(): string;
		toUrl(): string;
	}

	export interface ModuleCompileOptions {
		dev?: boolean;
		generate?: 'client' | 'server' | false;
		filename?: string;
		rootDir?: string;
		warningFilter?: (warning: Warning) => boolean;
		experimental?: { async?: boolean };
	}

	export interface CompileOptions extends ModuleCompileOptions {
		name?: string;
		customElement?: boolean;
		namespace?: AST.Namespace;
		css?: 'injected' | 'external';
		cssHash?: (input: {
			name: string;
			filename: string;
			css: string;
			hash: (input: string) => string;
		}) => string;
		preserveComments?: boolean;
		preserveWhitespace?: boolean;
		fragments?: 'html' | 'tree';
		runes?: boolean | undefined;
		discloseVersion?: boolean;
		sourcemap?: object | string;
		outputFilename?: string;
		cssOutputFilename?: string;
		hmr?: boolean;
		modernAst?: boolean;
	}

	export interface CompileResult {
		js: { code: string; map: SourceMap };
		css: null | { code: string; map: SourceMap; hasGlobal: boolean };
		warnings: Warning[];
		metadata: { runes: boolean };
		ast: any;
	}

	interface ParseOptions {
		filename?: string;
		rootDir?: string;
		loose?: boolean;
	}

	export function compile(source: string, options?: CompileOptions): CompileResult;
	export function compileModule(source: string, options?: ModuleCompileOptions): CompileResult;
	export function parse(source: string, options: ParseOptions & { modern: true }): AST.Root;
	export function parse(
		source: string,
		options?: (ParseOptions & { modern?: false }) | undefined
	): Record<string, any>;
	export function parseCss(source: string): AST.CSS.StyleSheetFile;

	export interface Processed {
		code: string;
		map?: string | object;
		dependencies?: string[];
		attributes?: Record<string, string | boolean>;
		toString?: () => string;
	}

	export type MarkupPreprocessor = (options: {
		content: string;
		filename?: string;
	}) => Processed | void | Promise<Processed | void>;

	export type Preprocessor = (options: {
		content: string;
		attributes: Record<string, string | boolean>;
		markup: string;
		filename?: string;
	}) => Processed | void | Promise<Processed | void>;

	export interface PreprocessorGroup {
		name?: string;
		markup?: MarkupPreprocessor;
		style?: Preprocessor;
		script?: Preprocessor;
	}

	export function preprocess(
		source: string,
		preprocessor: PreprocessorGroup | PreprocessorGroup[],
		options?: { filename?: string } | undefined
	): Promise<Processed>;

	export function print(
		ast: AST.SvelteNode,
		options?:
			| {
					indent?: string;
					getLeadingComments?: (node: any) => any[] | undefined;
					getTrailingComments?: (node: any) => any[] | undefined;
			  }
			| undefined
	): { code: string; map: any };

	export {};
}

declare module 'svelte/types/compiler/preprocess' {
	import type { PreprocessorGroup } from 'svelte/compiler';

	export type {
		MarkupPreprocessor,
		Preprocessor,
		PreprocessorGroup,
		Processed
	} from 'svelte/compiler';

	export interface SveltePreprocessor<
		PreprocessorType extends keyof PreprocessorGroup,
		Options = any
	> {
		(options?: Options): Required<Pick<PreprocessorGroup, PreprocessorType>>;
	}

	export {};
}

declare module 'svelte/types/compiler/interfaces' {
	export type { CompileOptions, Warning } from 'svelte/compiler';

	export {};
}

declare module 'svelte/compiler' {
	import type * as ES from 'estree';

	export namespace AST {
		interface Located {
			start: number;
			end: number;
		}

		export interface BaseNode extends Located {
			type: string;
		}

		export interface Position {
			line: number;
			column: number;
			character: number;
		}

		export interface NameLocation {
			start: Position;
			end: Position;
		}

		export type Namespace = 'html' | 'svg' | 'mathml';

		export interface Root extends BaseNode {
			type: 'Root';
			options: SvelteOptions | null;
			fragment: Fragment;
			css: CSS.StyleSheet | null;
			instance?: Script;
			module?: Script;
			comments: JSComment[];
		}

		export interface Fragment {
			type: 'Fragment';
			nodes: Array<Text | Comment | Tag | ElementLike | Block>;
		}

		export interface SvelteOptions extends Located {
			attributes: Attribute[];
			runes?: boolean;
			immutable?: boolean;
			accessors?: boolean;
			preserveWhitespace?: boolean;
			namespace?: Namespace;
			css?: 'injected';
			customElement?: {
				tag?: string;
				shadow?: 'open' | 'none' | ES.ObjectExpression | undefined;
				props?: Record<
					string,
					{
						attribute?: string;
						reflect?: boolean;
						type?: 'Array' | 'Boolean' | 'Number' | 'Object' | 'String';
					}
				>;
				extend?: ES.ArrowFunctionExpression | ES.Identifier;
			};
		}

		export interface Script extends BaseNode {
			type: 'Script';
			context: 'default' | 'module';
			content: ES.Program;
			attributes: Attribute[];
		}

		export interface JSComment extends Located {
			type: 'Line' | 'Block';
			value: string;
			loc?: {
				start: { line: number; column: number };
				end: { line: number; column: number };
			};
		}

		export interface Text extends BaseNode {
			type: 'Text';
			data: string;
			raw: string;
		}

		export interface Comment extends BaseNode {
			type: 'Comment';
			data: string;
		}

		export interface ExpressionTag extends BaseNode {
			type: 'ExpressionTag';
			expression: ES.Expression;
		}

		export interface HtmlTag extends BaseNode {
			type: 'HtmlTag';
			expression: ES.Expression;
		}

		export interface ConstTag extends BaseNode {
			type: 'ConstTag';
			declaration: ES.VariableDeclaration & {
				declarations: [ES.VariableDeclarator & { id: ES.Pattern; init: ES.Expression }];
			};
		}

		export interface DeclarationTag extends BaseNode {
			type: 'DeclarationTag';
			declaration: ES.VariableDeclaration;
		}

		export interface DebugTag extends BaseNode {
			type: 'DebugTag';
			identifiers: ES.Identifier[];
		}

		export interface RenderTag extends BaseNode {
			type: 'RenderTag';
			expression:
				| ES.SimpleCallExpression
				| (ES.ChainExpression & { expression: ES.SimpleCallExpression });
		}

		export interface AttachTag extends BaseNode {
			type: 'AttachTag';
			expression: ES.Expression;
		}

		export interface BaseAttribute extends BaseNode {
			name: string;
			name_loc: NameLocation | null;
		}

		export interface Attribute extends BaseAttribute {
			type: 'Attribute';
			value: true | ExpressionTag | Array<Text | ExpressionTag>;
		}

		export interface SpreadAttribute extends BaseNode {
			type: 'SpreadAttribute';
			expression: ES.Expression;
		}

		export interface AnimateDirective extends BaseAttribute {
			type: 'AnimateDirective';
			expression: ES.Expression | null;
		}

		export interface BindDirective extends BaseAttribute {
			type: 'BindDirective';
			expression: ES.Identifier | ES.MemberExpression | ES.SequenceExpression;
		}

		export interface ClassDirective extends BaseAttribute {
			type: 'ClassDirective';
			expression: ES.Expression;
		}

		export interface LetDirective extends BaseAttribute {
			type: 'LetDirective';
			expression: ES.Identifier | ES.ArrayExpression | ES.ObjectExpression | null;
		}

		export interface OnDirective extends BaseAttribute {
			type: 'OnDirective';
			expression: ES.Expression | null;
			modifiers: Array<
				| 'capture'
				| 'nonpassive'
				| 'once'
				| 'passive'
				| 'preventDefault'
				| 'self'
				| 'stopImmediatePropagation'
				| 'stopPropagation'
				| 'trusted'
			>;
		}

		export interface StyleDirective extends BaseAttribute {
			type: 'StyleDirective';
			value: true | ExpressionTag | Array<ExpressionTag | Text>;
			modifiers: Array<'important'>;
		}

		export interface TransitionDirective extends BaseAttribute {
			type: 'TransitionDirective';
			expression: ES.Expression | null;
			modifiers: Array<'local' | 'global'>;
			intro: boolean;
			outro: boolean;
		}

		export interface UseDirective extends BaseAttribute {
			type: 'UseDirective';
			expression: ES.Expression | null;
		}

		export type Directive =
			| AnimateDirective
			| BindDirective
			| ClassDirective
			| LetDirective
			| OnDirective
			| StyleDirective
			| TransitionDirective
			| UseDirective;

		export type AttributeLike = Attribute | SpreadAttribute | Directive;

		export interface BaseElement extends BaseNode {
			name: string;
			name_loc: NameLocation;
			attributes: Array<Attribute | SpreadAttribute | Directive | AttachTag>;
			fragment: Fragment;
		}

		export interface RegularElement extends BaseElement {
			type: 'RegularElement';
		}

		export interface Component extends BaseElement {
			type: 'Component';
		}

		export interface TitleElement extends BaseElement {
			type: 'TitleElement';
			name: 'title';
		}

		export interface SlotElement extends BaseElement {
			type: 'SlotElement';
			name: 'slot';
		}

		export interface SvelteBody extends BaseElement {
			type: 'SvelteBody';
			name: 'svelte:body';
		}

		export interface SvelteBoundary extends BaseElement {
			type: 'SvelteBoundary';
			name: 'svelte:boundary';
		}

		export interface SvelteComponent extends BaseElement {
			type: 'SvelteComponent';
			name: 'svelte:component';
			expression: ES.Expression;
		}

		export interface SvelteDocument extends BaseElement {
			type: 'SvelteDocument';
			name: 'svelte:document';
		}

		export interface SvelteElement extends BaseElement {
			type: 'SvelteElement';
			name: 'svelte:element';
			tag: ES.Expression;
		}

		export interface SvelteFragment extends BaseElement {
			type: 'SvelteFragment';
			name: 'svelte:fragment';
		}

		export interface SvelteHead extends BaseElement {
			type: 'SvelteHead';
			name: 'svelte:head';
		}

		export interface SvelteOptionsRaw extends BaseElement {
			type: 'SvelteOptions';
			name: 'svelte:options';
		}

		export interface SvelteSelf extends BaseElement {
			type: 'SvelteSelf';
			name: 'svelte:self';
		}

		export interface SvelteWindow extends BaseElement {
			type: 'SvelteWindow';
			name: 'svelte:window';
		}

		export type ElementLike =
			| RegularElement
			| Component
			| TitleElement
			| SlotElement
			| SvelteBody
			| SvelteBoundary
			| SvelteComponent
			| SvelteDocument
			| SvelteElement
			| SvelteFragment
			| SvelteHead
			| SvelteOptionsRaw
			| SvelteSelf
			| SvelteWindow;

		export interface IfBlock extends BaseNode {
			type: 'IfBlock';
			elseif: boolean;
			test: ES.Expression;
			consequent: Fragment;
			alternate: Fragment | null;
		}

		export interface EachBlock extends BaseNode {
			type: 'EachBlock';
			expression: ES.Expression;
			context: ES.Pattern | null;
			body: Fragment;
			fallback?: Fragment;
			index?: string;
			key?: ES.Expression;
		}

		export interface AwaitBlock extends BaseNode {
			type: 'AwaitBlock';
			expression: ES.Expression;
			value: ES.Pattern | null;
			error: ES.Pattern | null;
			pending: Fragment | null;
			then: Fragment | null;
			catch: Fragment | null;
		}

		export interface KeyBlock extends BaseNode {
			type: 'KeyBlock';
			expression: ES.Expression;
			fragment: Fragment;
		}

		export interface SnippetBlock extends BaseNode {
			type: 'SnippetBlock';
			expression: ES.Identifier;
			parameters: ES.Pattern[];
			typeParams?: string;
			body: Fragment;
		}

		export type Block = EachBlock | IfBlock | AwaitBlock | KeyBlock | SnippetBlock;

		export type Tag =
			| AttachTag
			| ConstTag
			| DeclarationTag
			| DebugTag
			| ExpressionTag
			| HtmlTag
			| RenderTag;

		export type TemplateNode =
			| Root
			| Text
			| Tag
			| ElementLike
			| Attribute
			| SpreadAttribute
			| Directive
			| Comment
			| Block;

		export type SvelteNode = ES.Node | TemplateNode | Fragment | CSS.Node | Script;

		export namespace CSS {
			export interface BaseNode {
				start: number;
				end: number;
			}

			export interface CSSComment extends BaseNode {
				type: 'CSSComment';
				value: string;
				position?: number;
			}

			export interface StyleSheetBase extends BaseNode {
				children: Array<Atrule | Rule>;
				comments: CSSComment[];
			}

			export interface StyleSheetFile extends StyleSheetBase {
				type: 'StyleSheetFile';
			}

			export interface StyleSheet extends StyleSheetBase {
				type: 'StyleSheet';
				attributes: any[];
				content: {
					start: number;
					end: number;
					styles: string;
					comment: AST.Comment | null;
				};
			}

			export interface Atrule extends BaseNode {
				type: 'Atrule';
				name: string;
				prelude: string;
				block: Block | null;
			}

			export interface Rule extends BaseNode {
				type: 'Rule';
				prelude: SelectorList;
				block: Block;
			}

			export interface Block extends BaseNode {
				type: 'Block';
				children: Array<Declaration | Rule | Atrule>;
			}

			export interface Declaration extends BaseNode {
				type: 'Declaration';
				property: string;
				value: string;
			}

			export interface SelectorList extends BaseNode {
				type: 'SelectorList';
				children: ComplexSelector[];
			}

			export interface ComplexSelector extends BaseNode {
				type: 'ComplexSelector';
				children: RelativeSelector[];
			}

			export interface RelativeSelector extends BaseNode {
				type: 'RelativeSelector';
				combinator: Combinator | null;
				selectors: SimpleSelector[];
			}

			export interface Combinator extends BaseNode {
				type: 'Combinator';
				name: string;
			}

			export interface TypeSelector extends BaseNode {
				type: 'TypeSelector';
				name: string;
				namespace?: string;
			}

			export interface IdSelector extends BaseNode {
				type: 'IdSelector';
				name: string;
			}

			export interface ClassSelector extends BaseNode {
				type: 'ClassSelector';
				name: string;
			}

			export interface NestingSelector extends BaseNode {
				type: 'NestingSelector';
				name: '&';
			}

			export interface AttributeSelector extends BaseNode {
				type: 'AttributeSelector';
				name: string;
				matcher: string | null;
				value: string | null;
				flags: string | null;
			}

			export interface PseudoElementSelector extends BaseNode {
				type: 'PseudoElementSelector';
				name: string;
				args?: SelectorList;
			}

			export interface PseudoClassSelector extends BaseNode {
				type: 'PseudoClassSelector';
				name: string;
				args: SelectorList | null;
			}

			export interface Nth extends BaseNode {
				type: 'Nth';
				value: string;
			}

			export interface Percentage extends BaseNode {
				type: 'Percentage';
				value: string;
			}

			export type SimpleSelector =
				| TypeSelector
				| IdSelector
				| ClassSelector
				| NestingSelector
				| AttributeSelector
				| PseudoElementSelector
				| PseudoClassSelector
				| Nth
				| Percentage;

			export type Node =
				| StyleSheet
				| Rule
				| Atrule
				| SelectorList
				| Block
				| ComplexSelector
				| RelativeSelector
				| Combinator
				| SimpleSelector
				| Declaration;

			export {};
		}

		export {};
	}

	export {};
}

declare module '*.svelte' {
	import type { Component } from 'svelte';

	const component: Component<any, any, any>;
	export default component;

	export {};
}

declare function $state<T>(initial: T): T;
declare function $state<T>(): T | undefined;

declare namespace $state {
	type Primitive = string | number | bigint | boolean | symbol | null | undefined;

	type TypedArray =
		| Int8Array
		| Uint8Array
		| Uint8ClampedArray
		| Int16Array
		| Uint16Array
		| Int32Array
		| Uint32Array
		| Float32Array
		| Float64Array
		| BigInt64Array
		| BigUint64Array;

	export type Cloneable =
		| ArrayBuffer
		| DataView
		| Date
		| Error
		| Map<any, any>
		| RegExp
		| Set<any>
		| TypedArray
		| Blob
		| CryptoKey
		| DOMException
		| DOMMatrix
		| DOMMatrixReadOnly
		| DOMPoint
		| DOMPointReadOnly
		| DOMQuad
		| DOMRect
		| DOMRectReadOnly
		| File
		| FileList
		| FileSystemDirectoryHandle
		| FileSystemFileHandle
		| FileSystemHandle
		| ImageBitmap
		| ImageData
		| RTCCertificate
		| VideoFrame;

	type Plain<T> = T extends Date
		? Date
		: T extends Map<infer K, infer V>
			? Map<K, V>
			: T extends Set<infer V>
				? Set<V>
				: T;

	type Snapshot<T> = T extends Primitive
		? T
		: T extends Cloneable
			? Plain<T>
			: T extends { toJSON(): infer R }
				? R
				: T extends readonly unknown[]
					? { [K in keyof T]: Snapshot<T[K]> }
					: T extends object
						? T extends { [key: string]: any }
							? { [K in keyof T]: Snapshot<T[K]> }
							: never
						: never;

	export function raw<T>(initial: T): T;
	export function raw<T>(): T | undefined;
	export function snapshot<T>(state: T): Snapshot<T>;
	export function eager<T>(value: T): T;

	export const apply: never;
	export const bind: never;
	export const call: never;
	export const caller: never;
	export const length: never;
	export const name: never;
	export const prototype: never;
	export const toString: never;

	export {};
}

declare function $derived<T>(expression: T): T;

declare namespace $derived {
	export function by<T>(fn: () => T): T;

	export const apply: never;
	export const bind: never;
	export const call: never;
	export const caller: never;
	export const length: never;
	export const name: never;
	export const prototype: never;
	export const toString: never;

	export {};
}

declare function $effect(fn: () => void | (() => void)): void;

declare namespace $effect {
	export function pre(fn: () => void | (() => void)): void;
	export function pending(): number;
	export function tracking(): boolean;
	export function root(fn: () => void | (() => void)): () => void;

	export const apply: never;
	export const bind: never;
	export const call: never;
	export const caller: never;
	export const length: never;
	export const name: never;
	export const prototype: never;
	export const toString: never;

	export {};
}

declare function $props(): any;

declare namespace $props {
	export function id(): string;

	export const apply: never;
	export const bind: never;
	export const call: never;
	export const caller: never;
	export const length: never;
	export const name: never;
	export const prototype: never;
	export const toString: never;

	export {};
}

declare function $bindable<T>(fallback?: T): T;

declare namespace $bindable {
	export const apply: never;
	export const bind: never;
	export const call: never;
	export const caller: never;
	export const length: never;
	export const name: never;
	export const prototype: never;
	export const toString: never;

	export {};
}

declare function $inspect<T extends any[]>(
	...values: T
): { with: (fn: (type: 'init' | 'update', ...values: T) => void) => void };

declare namespace $inspect {
	export function trace(name?: string): void;

	export const apply: never;
	export const bind: never;
	export const call: never;
	export const caller: never;
	export const length: never;
	export const name: never;
	export const prototype: never;
	export const toString: never;

	export {};
}

declare function $host<El extends HTMLElement = HTMLElement>(): El;

declare namespace $host {
	export const apply: never;
	export const bind: never;
	export const call: never;
	export const caller: never;
	export const length: never;
	export const name: never;
	export const prototype: never;
	export const toString: never;

	export {};
}
