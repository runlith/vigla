import type { Snippet } from 'svelte';
import type { Attachment } from 'svelte/attachments';

type Nullish = undefined | null;

type Booleanish = boolean | 'true' | 'false';

type Numberish = number | string;

type EventHandler<E extends Event = Event, T extends EventTarget = Element> = (
	event: E & { currentTarget: EventTarget & T }
) => any;

type Handlers<Events, T extends EventTarget> = {
	[K in keyof Events & string as `on${K}` | `on${K}capture`]?:
		| EventHandler<Events[K] extends Event ? Events[K] : Event, T>
		| Nullish;
};

export type ClipboardEventHandler<T extends EventTarget> = EventHandler<ClipboardEvent, T>;
export type CompositionEventHandler<T extends EventTarget> = EventHandler<CompositionEvent, T>;
export type DragEventHandler<T extends EventTarget> = EventHandler<DragEvent, T>;
export type FocusEventHandler<T extends EventTarget> = EventHandler<FocusEvent, T>;
export type FormEventHandler<T extends EventTarget> = EventHandler<Event, T>;
export type ChangeEventHandler<T extends EventTarget> = EventHandler<Event, T>;
export type KeyboardEventHandler<T extends EventTarget> = EventHandler<KeyboardEvent, T>;
export type MouseEventHandler<T extends EventTarget> = EventHandler<MouseEvent, T>;
export type TouchEventHandler<T extends EventTarget> = EventHandler<TouchEvent, T>;
export type PointerEventHandler<T extends EventTarget> = EventHandler<PointerEvent, T>;
export type GamepadEventHandler<T extends EventTarget> = EventHandler<GamepadEvent, T>;
export type UIEventHandler<T extends EventTarget> = EventHandler<UIEvent, T>;
export type WheelEventHandler<T extends EventTarget> = EventHandler<WheelEvent, T>;
export type AnimationEventHandler<T extends EventTarget> = EventHandler<AnimationEvent, T>;
export type TransitionEventHandler<T extends EventTarget> = EventHandler<TransitionEvent, T>;
export type MessageEventHandler<T extends EventTarget> = EventHandler<MessageEvent, T>;
export type ToggleEventHandler<T extends EventTarget> = EventHandler<ToggleEvent, T>;
export type ContentVisibilityAutoStateChangeEventHandler<T extends EventTarget> = EventHandler<
	ContentVisibilityAutoStateChangeEvent,
	T
>;

type AutoFillExtraField =
	| 'bday'
	| 'cc-additional-name'
	| 'impp'
	| 'language'
	| 'nickname'
	| 'organization-title'
	| 'photo'
	| 'sex'
	| 'url';

export type FullAutoFill =
	| AutoFill
	| `${OptionalPrefixToken<AutoFillSection>}${OptionalPrefixToken<AutoFillAddressKind>}${AutoFillExtraField}${OptionalPostfixToken<AutoFillCredentialField>}`;

export type ClassValue =
	| string
	| number
	| bigint
	| boolean
	| Nullish
	| ClassValue[]
	| { [name: string]: any };

export interface SvelteMediaTimeRange {
	start: number;
	end: number;
}

export type AriaRole =
	| 'alert'
	| 'alertdialog'
	| 'application'
	| 'article'
	| 'banner'
	| 'blockquote'
	| 'button'
	| 'caption'
	| 'cell'
	| 'checkbox'
	| 'code'
	| 'columnheader'
	| 'combobox'
	| 'comment'
	| 'complementary'
	| 'contentinfo'
	| 'definition'
	| 'deletion'
	| 'dialog'
	| 'directory'
	| 'document'
	| 'emphasis'
	| 'feed'
	| 'figure'
	| 'form'
	| 'generic'
	| 'grid'
	| 'gridcell'
	| 'group'
	| 'heading'
	| 'img'
	| 'insertion'
	| 'link'
	| 'list'
	| 'listbox'
	| 'listitem'
	| 'log'
	| 'main'
	| 'mark'
	| 'marquee'
	| 'math'
	| 'menu'
	| 'menubar'
	| 'menuitem'
	| 'menuitemcheckbox'
	| 'menuitemradio'
	| 'meter'
	| 'navigation'
	| 'none'
	| 'note'
	| 'option'
	| 'paragraph'
	| 'presentation'
	| 'progressbar'
	| 'radio'
	| 'radiogroup'
	| 'region'
	| 'row'
	| 'rowgroup'
	| 'rowheader'
	| 'scrollbar'
	| 'search'
	| 'searchbox'
	| 'separator'
	| 'slider'
	| 'spinbutton'
	| 'status'
	| 'strong'
	| 'subscript'
	| 'suggestion'
	| 'superscript'
	| 'switch'
	| 'tab'
	| 'table'
	| 'tablist'
	| 'tabpanel'
	| 'term'
	| 'textbox'
	| 'time'
	| 'timer'
	| 'toolbar'
	| 'tooltip'
	| 'tree'
	| 'treegrid'
	| 'treeitem'
	| (string & {});

export interface AriaAttributes {
	'aria-activedescendant'?: string | Nullish;
	'aria-atomic'?: Booleanish | Nullish;
	'aria-autocomplete'?: 'none' | 'inline' | 'list' | 'both' | Nullish;
	'aria-braillelabel'?: string | Nullish;
	'aria-brailleroledescription'?: string | Nullish;
	'aria-busy'?: Booleanish | Nullish;
	'aria-checked'?: boolean | 'false' | 'mixed' | 'true' | Nullish;
	'aria-colcount'?: number | Nullish;
	'aria-colindex'?: number | Nullish;
	'aria-colindextext'?: string | Nullish;
	'aria-colspan'?: number | Nullish;
	'aria-controls'?: string | Nullish;
	'aria-current'?: Booleanish | 'page' | 'step' | 'location' | 'date' | 'time' | Nullish;
	'aria-describedby'?: string | Nullish;
	'aria-description'?: string | Nullish;
	'aria-details'?: string | Nullish;
	'aria-disabled'?: Booleanish | Nullish;
	'aria-dropeffect'?: 'none' | 'copy' | 'execute' | 'link' | 'move' | 'popup' | Nullish;
	'aria-errormessage'?: string | Nullish;
	'aria-expanded'?: Booleanish | Nullish;
	'aria-flowto'?: string | Nullish;
	'aria-grabbed'?: Booleanish | Nullish;
	'aria-haspopup'?: Booleanish | 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog' | Nullish;
	'aria-hidden'?: Booleanish | Nullish;
	'aria-invalid'?: Booleanish | 'grammar' | 'spelling' | Nullish;
	'aria-keyshortcuts'?: string | Nullish;
	'aria-label'?: string | Nullish;
	'aria-labelledby'?: string | Nullish;
	'aria-level'?: number | Nullish;
	'aria-live'?: 'off' | 'assertive' | 'polite' | Nullish;
	'aria-modal'?: Booleanish | Nullish;
	'aria-multiline'?: Booleanish | Nullish;
	'aria-multiselectable'?: Booleanish | Nullish;
	'aria-orientation'?: 'horizontal' | 'vertical' | Nullish;
	'aria-owns'?: string | Nullish;
	'aria-placeholder'?: string | Nullish;
	'aria-posinset'?: number | Nullish;
	'aria-pressed'?: boolean | 'false' | 'mixed' | 'true' | Nullish;
	'aria-readonly'?: Booleanish | Nullish;
	'aria-relevant'?:
		| 'additions'
		| 'additions removals'
		| 'additions text'
		| 'all'
		| 'removals'
		| 'removals additions'
		| 'removals text'
		| 'text'
		| 'text additions'
		| 'text removals'
		| Nullish;
	'aria-required'?: Booleanish | Nullish;
	'aria-roledescription'?: string | Nullish;
	'aria-rowcount'?: number | Nullish;
	'aria-rowindex'?: number | Nullish;
	'aria-rowindextext'?: string | Nullish;
	'aria-rowspan'?: number | Nullish;
	'aria-selected'?: Booleanish | Nullish;
	'aria-setsize'?: number | Nullish;
	'aria-sort'?: 'none' | 'ascending' | 'descending' | 'other' | Nullish;
	'aria-valuemax'?: number | Nullish;
	'aria-valuemin'?: number | Nullish;
	'aria-valuenow'?: number | Nullish;
	'aria-valuetext'?: string | Nullish;
}

type ElementBindings = {
	readonly 'bind:clientWidth'?: number | Nullish;
	readonly 'bind:clientHeight'?: number | Nullish;
	readonly 'bind:offsetWidth'?: number | Nullish;
	readonly 'bind:offsetHeight'?: number | Nullish;
	readonly 'bind:contentRect'?: DOMRectReadOnly | Nullish;
	readonly 'bind:contentBoxSize'?: Array<ResizeObserverSize> | Nullish;
	readonly 'bind:borderBoxSize'?: Array<ResizeObserverSize> | Nullish;
	readonly 'bind:devicePixelContentBoxSize'?: Array<ResizeObserverSize> | Nullish;
	readonly 'bind:focused'?: boolean | Nullish;
	'bind:innerHTML'?: string | Nullish;
	'bind:innerText'?: string | Nullish;
	'bind:textContent'?: string | Nullish;
};

interface TransitionEventMap {
	introstart: CustomEvent<null>;
	introend: CustomEvent<null>;
	outrostart: CustomEvent<null>;
	outroend: CustomEvent<null>;
}

export interface DOMAttributes<T extends EventTarget> extends Handlers<
	HTMLElementEventMap & TransitionEventMap,
	T
> {
	children?: Snippet;
	[key: symbol]: Attachment<T> | false | Nullish;
}

export interface HTMLAttributes<T extends EventTarget>
	extends AriaAttributes, DOMAttributes<T>, ElementBindings {
	accesskey?: string | Nullish;
	autocapitalize?: 'off' | 'none' | 'on' | 'sentences' | 'words' | 'characters' | Nullish;
	autocorrect?: 'on' | 'off' | '' | Nullish;
	autofocus?: boolean | Nullish;
	class?: ClassValue | Nullish;
	contenteditable?: Booleanish | 'inherit' | 'plaintext-only' | Nullish;
	contextmenu?: string | Nullish;
	dir?: 'ltr' | 'rtl' | 'auto' | Nullish;
	draggable?: Booleanish | Nullish;
	enterkeyhint?: 'enter' | 'done' | 'go' | 'next' | 'previous' | 'search' | 'send' | Nullish;
	exportparts?: string | Nullish;
	hidden?: boolean | 'until-found' | Nullish;
	id?: string | Nullish;
	inert?: boolean | Nullish;
	inputmode?:
		| 'none'
		| 'text'
		| 'tel'
		| 'url'
		| 'email'
		| 'numeric'
		| 'decimal'
		| 'search'
		| Nullish;
	is?: string | Nullish;
	itemid?: string | Nullish;
	itemprop?: string | Nullish;
	itemref?: string | Nullish;
	itemscope?: boolean | Nullish;
	itemtype?: string | Nullish;
	lang?: string | Nullish;
	nonce?: string | Nullish;
	part?: string | Nullish;
	popover?: 'auto' | 'manual' | 'hint' | '' | boolean | Nullish;
	role?: AriaRole | Nullish;
	slot?: string | Nullish;
	spellcheck?: Booleanish | Nullish;
	style?: string | Nullish;
	tabindex?: number | Nullish;
	title?: string | Nullish;
	translate?: 'yes' | 'no' | '' | Nullish;
	writingsuggestions?: Booleanish | Nullish;

	about?: string | Nullish;
	datatype?: string | Nullish;
	inlist?: any;
	prefix?: string | Nullish;
	property?: string | Nullish;
	resource?: string | Nullish;
	typeof?: string | Nullish;
	vocab?: string | Nullish;

	[key: `data-${string}`]: any;
}

export type HTMLAttributeAnchorTarget = '_self' | '_blank' | '_parent' | '_top' | (string & {});

type ReferrerPolicyValue = ReferrerPolicy | Nullish;

type CrossOrigin = 'anonymous' | 'use-credentials' | '' | true | Nullish;

type FetchPriority = 'high' | 'low' | 'auto' | Nullish;

type FormMethod = 'get' | 'post' | 'dialog' | 'GET' | 'POST' | 'DIALOG' | Nullish;

type FormEncoding =
	| 'application/x-www-form-urlencoded'
	| 'multipart/form-data'
	| 'text/plain'
	| (string & {})
	| Nullish;

type Shape = 'circle' | 'default' | 'poly' | 'rect' | Nullish;

export interface HTMLAnchorAttributes extends HTMLAttributes<HTMLAnchorElement> {
	download?: any;
	href?: string | Nullish;
	hreflang?: string | Nullish;
	media?: string | Nullish;
	ping?: string | Nullish;
	referrerpolicy?: ReferrerPolicyValue;
	rel?: string | Nullish;
	target?: HTMLAttributeAnchorTarget | Nullish;
	type?: string | Nullish;
	'sveltekit:noscroll'?: true | '' | 'off' | Nullish;
	'sveltekit:prefetch'?: true | '' | 'off' | Nullish;
	'data-sveltekit-keepfocus'?: true | '' | 'off' | Nullish;
	'data-sveltekit-noscroll'?: true | '' | 'off' | Nullish;
	'data-sveltekit-preload-code'?:
		| true
		| ''
		| 'eager'
		| 'viewport'
		| 'hover'
		| 'tap'
		| 'off'
		| Nullish;
	'data-sveltekit-preload-data'?: true | '' | 'hover' | 'tap' | 'off' | Nullish;
	'data-sveltekit-reload'?: true | '' | 'off' | Nullish;
	'data-sveltekit-replacestate'?: true | '' | 'off' | Nullish;
}

export interface HTMLAreaAttributes extends HTMLAttributes<HTMLAreaElement> {
	alt?: string | Nullish;
	coords?: string | Nullish;
	download?: any;
	href?: string | Nullish;
	hreflang?: string | Nullish;
	media?: string | Nullish;
	ping?: string | Nullish;
	referrerpolicy?: ReferrerPolicyValue;
	rel?: string | Nullish;
	shape?: Shape;
	target?: HTMLAttributeAnchorTarget | Nullish;
}

export interface HTMLBaseAttributes extends HTMLAttributes<HTMLBaseElement> {
	href?: string | Nullish;
	target?: HTMLAttributeAnchorTarget | Nullish;
}

export interface HTMLBlockquoteAttributes extends HTMLAttributes<HTMLQuoteElement> {
	cite?: string | Nullish;
}

export interface HTMLQuoteAttributes extends HTMLAttributes<HTMLQuoteElement> {
	cite?: string | Nullish;
}

export interface HTMLButtonAttributes extends HTMLAttributes<HTMLButtonElement> {
	command?: string | Nullish;
	commandfor?: string | Nullish;
	disabled?: boolean | Nullish;
	form?: string | Nullish;
	formaction?: string | Nullish;
	formenctype?: FormEncoding;
	formmethod?: FormMethod;
	formnovalidate?: boolean | Nullish;
	formtarget?: string | Nullish;
	name?: string | Nullish;
	popovertarget?: string | Nullish;
	popovertargetaction?: 'toggle' | 'show' | 'hide' | Nullish;
	type?: 'submit' | 'reset' | 'button' | Nullish;
	value?: string | number | string[] | Nullish;
	'sveltekit:noscroll'?: true | '' | 'off' | Nullish;
	'data-sveltekit-keepfocus'?: true | '' | 'off' | Nullish;
	'data-sveltekit-noscroll'?: true | '' | 'off' | Nullish;
	'data-sveltekit-reload'?: true | '' | 'off' | Nullish;
	'data-sveltekit-replacestate'?: true | '' | 'off' | Nullish;
}

export interface HTMLCanvasAttributes extends HTMLAttributes<HTMLCanvasElement> {
	height?: Numberish | Nullish;
	width?: Numberish | Nullish;
}

export interface HTMLColAttributes extends HTMLAttributes<HTMLTableColElement> {
	span?: number | Nullish;
	width?: Numberish | Nullish;
}

export interface HTMLColgroupAttributes extends HTMLAttributes<HTMLTableColElement> {
	span?: number | Nullish;
}

export interface HTMLDataAttributes extends HTMLAttributes<HTMLDataElement> {
	value?: string | number | string[] | Nullish;
}

export interface HTMLDetailsAttributes extends HTMLAttributes<HTMLDetailsElement> {
	open?: boolean | Nullish;
	name?: string | Nullish;
	'bind:open'?: boolean | Nullish;
}

export interface HTMLDelAttributes extends HTMLAttributes<HTMLModElement> {
	cite?: string | Nullish;
	datetime?: string | Nullish;
}

export interface HTMLInsAttributes extends HTMLAttributes<HTMLModElement> {
	cite?: string | Nullish;
	datetime?: string | Nullish;
}

export interface HTMLDialogAttributes extends HTMLAttributes<HTMLDialogElement> {
	closedby?: 'any' | 'closerequest' | 'none' | Nullish;
	open?: boolean | Nullish;
}

export interface HTMLEmbedAttributes extends HTMLAttributes<HTMLEmbedElement> {
	height?: Numberish | Nullish;
	src?: string | Nullish;
	type?: string | Nullish;
	width?: Numberish | Nullish;
}

export interface HTMLFieldsetAttributes extends HTMLAttributes<HTMLFieldSetElement> {
	disabled?: boolean | Nullish;
	form?: string | Nullish;
	name?: string | Nullish;
}

export interface HTMLFormAttributes extends HTMLAttributes<HTMLFormElement> {
	'accept-charset'?: string | Nullish;
	acceptcharset?: string | Nullish;
	action?: string | Nullish;
	autocomplete?: AutoFillBase | Nullish;
	enctype?: FormEncoding;
	method?: FormMethod;
	name?: string | Nullish;
	novalidate?: boolean | Nullish;
	rel?: string | Nullish;
	target?: string | Nullish;
	'sveltekit:noscroll'?: true | '' | 'off' | Nullish;
	'data-sveltekit-keepfocus'?: true | '' | 'off' | Nullish;
	'data-sveltekit-noscroll'?: true | '' | 'off' | Nullish;
	'data-sveltekit-reload'?: true | '' | 'off' | Nullish;
	'data-sveltekit-replacestate'?: true | '' | 'off' | Nullish;
}

export interface HTMLHtmlAttributes extends HTMLAttributes<HTMLHtmlElement> {
	manifest?: string | Nullish;
	xmlns?: string | Nullish;
}

export interface HTMLIframeAttributes extends HTMLAttributes<HTMLIFrameElement> {
	allow?: string | Nullish;
	allowfullscreen?: boolean | Nullish;
	credentialless?: boolean | Nullish;
	csp?: string | Nullish;
	height?: Numberish | Nullish;
	loading?: 'eager' | 'lazy' | Nullish;
	name?: string | Nullish;
	referrerpolicy?: ReferrerPolicyValue;
	sandbox?: string | Nullish;
	src?: string | Nullish;
	srcdoc?: string | Nullish;
	width?: Numberish | Nullish;
}

export interface HTMLImgAttributes extends HTMLAttributes<HTMLImageElement> {
	alt?: string | Nullish;
	crossorigin?: CrossOrigin;
	decoding?: 'async' | 'auto' | 'sync' | Nullish;
	fetchpriority?: FetchPriority;
	height?: Numberish | Nullish;
	ismap?: boolean | Nullish;
	loading?: 'eager' | 'lazy' | Nullish;
	referrerpolicy?: ReferrerPolicyValue;
	sizes?: string | Nullish;
	src?: string | Nullish;
	srcset?: string | Nullish;
	usemap?: string | Nullish;
	width?: Numberish | Nullish;
	readonly 'bind:naturalWidth'?: number | Nullish;
	readonly 'bind:naturalHeight'?: number | Nullish;
}

export type HTMLInputTypeAttribute =
	| 'button'
	| 'checkbox'
	| 'color'
	| 'date'
	| 'datetime-local'
	| 'email'
	| 'file'
	| 'hidden'
	| 'image'
	| 'month'
	| 'number'
	| 'password'
	| 'radio'
	| 'range'
	| 'reset'
	| 'search'
	| 'submit'
	| 'tel'
	| 'text'
	| 'time'
	| 'url'
	| 'week'
	| (string & {});

export interface HTMLInputAttributes extends HTMLAttributes<HTMLInputElement> {
	accept?: string | Nullish;
	alpha?: boolean | Nullish;
	alt?: string | Nullish;
	autocomplete?: FullAutoFill | Nullish;
	capture?: boolean | 'user' | 'environment' | Nullish;
	checked?: boolean | Nullish;
	colorspace?: 'limited-srgb' | 'display-p3' | Nullish;
	dirname?: string | Nullish;
	disabled?: boolean | Nullish;
	form?: string | Nullish;
	formaction?: string | Nullish;
	formenctype?: FormEncoding;
	formmethod?: FormMethod;
	formnovalidate?: boolean | Nullish;
	formtarget?: string | Nullish;
	height?: Numberish | Nullish;
	indeterminate?: boolean | Nullish;
	list?: string | Nullish;
	max?: Numberish | Nullish;
	maxlength?: number | Nullish;
	min?: Numberish | Nullish;
	minlength?: number | Nullish;
	multiple?: boolean | Nullish;
	name?: string | Nullish;
	pattern?: string | Nullish;
	placeholder?: string | Nullish;
	popovertarget?: string | Nullish;
	popovertargetaction?: 'toggle' | 'show' | 'hide' | Nullish;
	readonly?: boolean | Nullish;
	required?: boolean | Nullish;
	size?: number | Nullish;
	src?: string | Nullish;
	step?: Numberish | Nullish;
	type?: HTMLInputTypeAttribute | Nullish;
	value?: any;
	width?: Numberish | Nullish;
	webkitdirectory?: boolean | Nullish;
	'bind:checked'?: boolean | Nullish;
	'bind:files'?: FileList | Nullish;
	'bind:group'?: any;
	'bind:indeterminate'?: boolean | Nullish;
	'bind:value'?: any;
}

export interface HTMLKeygenAttributes extends HTMLAttributes<HTMLElement> {
	challenge?: string | Nullish;
	disabled?: boolean | Nullish;
	form?: string | Nullish;
	keyparams?: string | Nullish;
	keytype?: string | Nullish;
	name?: string | Nullish;
}

export interface HTMLLabelAttributes extends HTMLAttributes<HTMLLabelElement> {
	for?: string | Nullish;
	form?: string | Nullish;
}

export interface HTMLLiAttributes extends HTMLAttributes<HTMLLIElement> {
	value?: number | Nullish;
}

export interface HTMLLinkAttributes extends HTMLAttributes<HTMLLinkElement> {
	as?: string | Nullish;
	blocking?: 'render' | Nullish;
	charset?: string | Nullish;
	color?: string | Nullish;
	crossorigin?: CrossOrigin;
	disabled?: boolean | Nullish;
	fetchpriority?: FetchPriority;
	href?: string | Nullish;
	hreflang?: string | Nullish;
	imagesizes?: string | Nullish;
	imagesrcset?: string | Nullish;
	integrity?: string | Nullish;
	media?: string | Nullish;
	referrerpolicy?: ReferrerPolicyValue;
	rel?: string | Nullish;
	sizes?: string | Nullish;
	type?: string | Nullish;
}

export interface HTMLMapAttributes extends HTMLAttributes<HTMLMapElement> {
	name?: string | Nullish;
}

export interface HTMLMenuAttributes extends HTMLAttributes<HTMLMenuElement> {
	type?: string | Nullish;
}

export interface HTMLMediaAttributes<T extends HTMLMediaElement>
	extends
		Omit<HTMLAttributes<T>, keyof Handlers<HTMLMediaElementEventMap, T>>,
		Handlers<HTMLMediaElementEventMap, T> {
	autoplay?: boolean | Nullish;
	controls?: boolean | Nullish;
	controlslist?:
		| 'nodownload'
		| 'nofullscreen'
		| 'noplaybackrate'
		| 'noremoteplayback'
		| (string & {})
		| Nullish;
	crossorigin?: CrossOrigin;
	currenttime?: number | Nullish;
	defaultmuted?: boolean | Nullish;
	defaultplaybackrate?: number | Nullish;
	disableremoteplayback?: boolean | Nullish;
	loop?: boolean | Nullish;
	mediagroup?: string | Nullish;
	muted?: boolean | Nullish;
	playsinline?: boolean | Nullish;
	preload?: 'auto' | 'none' | 'metadata' | '' | Nullish;
	src?: string | Nullish;
	srcobject?: MediaStream | MediaSource | Blob | Nullish;
	volume?: number | Nullish;
	readonly 'bind:buffered'?: SvelteMediaTimeRange[] | Nullish;
	readonly 'bind:duration'?: number | Nullish;
	readonly 'bind:ended'?: boolean | Nullish;
	readonly 'bind:played'?: SvelteMediaTimeRange[] | Nullish;
	readonly 'bind:readyState'?: 0 | 1 | 2 | 3 | 4 | Nullish;
	readonly 'bind:seekable'?: SvelteMediaTimeRange[] | Nullish;
	readonly 'bind:seeking'?: boolean | Nullish;
	'bind:currentTime'?: number | Nullish;
	'bind:muted'?: boolean | Nullish;
	'bind:paused'?: boolean | Nullish;
	'bind:playbackRate'?: number | Nullish;
	'bind:volume'?: number | Nullish;
}

export interface HTMLAudioAttributes extends HTMLMediaAttributes<HTMLAudioElement> {}

export interface HTMLVideoAttributes
	extends
		Omit<
			HTMLMediaAttributes<HTMLVideoElement>,
			keyof Handlers<HTMLVideoElementEventMap, HTMLVideoElement>
		>,
		Handlers<HTMLVideoElementEventMap, HTMLVideoElement> {
	disablepictureinpicture?: boolean | Nullish;
	height?: Numberish | Nullish;
	playsinline?: boolean | Nullish;
	poster?: string | Nullish;
	width?: Numberish | Nullish;
	readonly 'bind:videoWidth'?: number | Nullish;
	readonly 'bind:videoHeight'?: number | Nullish;
}

export interface HTMLMetaAttributes extends HTMLAttributes<HTMLMetaElement> {
	charset?: string | Nullish;
	content?: string | Nullish;
	'http-equiv'?:
		| 'content-security-policy'
		| 'content-type'
		| 'default-style'
		| 'refresh'
		| 'x-ua-compatible'
		| (string & {})
		| Nullish;
	media?: string | Nullish;
	name?: string | Nullish;
}

export interface HTMLMeterAttributes extends HTMLAttributes<HTMLMeterElement> {
	form?: string | Nullish;
	high?: number | Nullish;
	low?: number | Nullish;
	max?: Numberish | Nullish;
	min?: Numberish | Nullish;
	optimum?: number | Nullish;
	value?: string | number | string[] | Nullish;
}

export interface HTMLObjectAttributes extends HTMLAttributes<HTMLObjectElement> {
	data?: string | Nullish;
	form?: string | Nullish;
	height?: Numberish | Nullish;
	name?: string | Nullish;
	type?: string | Nullish;
	usemap?: string | Nullish;
	width?: Numberish | Nullish;
}

export interface HTMLOlAttributes extends HTMLAttributes<HTMLOListElement> {
	reversed?: boolean | Nullish;
	start?: number | Nullish;
	type?: '1' | 'a' | 'A' | 'i' | 'I' | Nullish;
}

export interface HTMLOptgroupAttributes extends HTMLAttributes<HTMLOptGroupElement> {
	disabled?: boolean | Nullish;
	label?: string | Nullish;
}

export interface HTMLOptionAttributes extends HTMLAttributes<HTMLOptionElement> {
	disabled?: boolean | Nullish;
	label?: string | Nullish;
	selected?: boolean | Nullish;
	value?: any;
}

export interface HTMLOutputAttributes extends HTMLAttributes<HTMLOutputElement> {
	for?: string | Nullish;
	form?: string | Nullish;
	name?: string | Nullish;
}

export interface HTMLParamAttributes extends HTMLAttributes<HTMLParamElement> {
	name?: string | Nullish;
	value?: string | number | string[] | Nullish;
}

export interface HTMLProgressAttributes extends HTMLAttributes<HTMLProgressElement> {
	max?: Numberish | Nullish;
	value?: string | number | string[] | Nullish;
}

export interface HTMLSlotAttributes extends HTMLAttributes<HTMLSlotElement> {
	name?: string | Nullish;
}

export interface HTMLScriptAttributes extends HTMLAttributes<HTMLScriptElement> {
	async?: boolean | Nullish;
	blocking?: 'render' | Nullish;
	charset?: string | Nullish;
	crossorigin?: CrossOrigin;
	defer?: boolean | Nullish;
	fetchpriority?: FetchPriority;
	integrity?: string | Nullish;
	nomodule?: boolean | Nullish;
	referrerpolicy?: ReferrerPolicyValue;
	src?: string | Nullish;
	type?: string | Nullish;
}

export interface HTMLSelectAttributes extends HTMLAttributes<HTMLSelectElement> {
	autocomplete?: FullAutoFill | Nullish;
	disabled?: boolean | Nullish;
	form?: string | Nullish;
	multiple?: boolean | Nullish;
	name?: string | Nullish;
	required?: boolean | Nullish;
	size?: number | Nullish;
	value?: any;
	'bind:value'?: any;
}

export interface HTMLSourceAttributes extends HTMLAttributes<HTMLSourceElement> {
	height?: Numberish | Nullish;
	media?: string | Nullish;
	sizes?: string | Nullish;
	src?: string | Nullish;
	srcset?: string | Nullish;
	type?: string | Nullish;
	width?: Numberish | Nullish;
}

export interface HTMLStyleAttributes extends HTMLAttributes<HTMLStyleElement> {
	blocking?: 'render' | Nullish;
	media?: string | Nullish;
	type?: string | Nullish;
}

export interface HTMLTableAttributes extends HTMLAttributes<HTMLTableElement> {
	align?: 'left' | 'center' | 'right' | Nullish;
	bgcolor?: string | Nullish;
	border?: number | Nullish;
	cellpadding?: Numberish | Nullish;
	cellspacing?: Numberish | Nullish;
	frame?: boolean | Nullish;
	rules?: 'none' | 'groups' | 'rows' | 'columns' | 'all' | Nullish;
	summary?: string | Nullish;
	width?: Numberish | Nullish;
}

export interface HTMLTdAttributes extends HTMLAttributes<HTMLTableCellElement> {
	abbr?: string | Nullish;
	align?: 'left' | 'center' | 'right' | 'justify' | 'char' | Nullish;
	colspan?: number | Nullish;
	headers?: string | Nullish;
	height?: Numberish | Nullish;
	rowspan?: number | Nullish;
	scope?: string | Nullish;
	valign?: 'top' | 'middle' | 'bottom' | 'baseline' | Nullish;
	width?: Numberish | Nullish;
}

export interface HTMLThAttributes extends HTMLAttributes<HTMLTableCellElement> {
	abbr?: string | Nullish;
	align?: 'left' | 'center' | 'right' | 'justify' | 'char' | Nullish;
	colspan?: number | Nullish;
	headers?: string | Nullish;
	rowspan?: number | Nullish;
	scope?: 'row' | 'col' | 'rowgroup' | 'colgroup' | (string & {}) | Nullish;
}

export interface HTMLTemplateAttributes extends HTMLAttributes<HTMLTemplateElement> {
	shadowrootclonable?: boolean | Nullish;
	shadowrootdelegatesfocus?: boolean | Nullish;
	shadowrootmode?: 'open' | 'closed' | Nullish;
	shadowrootserializable?: boolean | Nullish;
}

export interface HTMLTextareaAttributes extends HTMLAttributes<HTMLTextAreaElement> {
	autocomplete?: FullAutoFill | Nullish;
	cols?: number | Nullish;
	dirname?: string | Nullish;
	disabled?: boolean | Nullish;
	form?: string | Nullish;
	maxlength?: number | Nullish;
	minlength?: number | Nullish;
	name?: string | Nullish;
	placeholder?: string | Nullish;
	readonly?: boolean | Nullish;
	required?: boolean | Nullish;
	rows?: number | Nullish;
	value?: any;
	wrap?: 'hard' | 'soft' | 'off' | Nullish;
	'bind:value'?: any;
}

export interface HTMLTimeAttributes extends HTMLAttributes<HTMLTimeElement> {
	datetime?: string | Nullish;
}

export interface HTMLTrackAttributes extends HTMLAttributes<HTMLTrackElement> {
	default?: boolean | Nullish;
	kind?: 'subtitles' | 'captions' | 'descriptions' | 'chapters' | 'metadata' | Nullish;
	label?: string | Nullish;
	src?: string | Nullish;
	srclang?: string | Nullish;
}

export interface SvelteWindowAttributes extends Handlers<WindowEventMap, Window> {
	readonly 'bind:innerWidth'?: Window['innerWidth'] | Nullish;
	readonly 'bind:innerHeight'?: Window['innerHeight'] | Nullish;
	readonly 'bind:outerWidth'?: Window['outerWidth'] | Nullish;
	readonly 'bind:outerHeight'?: Window['outerHeight'] | Nullish;
	readonly 'bind:devicePixelRatio'?: Window['devicePixelRatio'] | Nullish;
	readonly 'bind:online'?: Window['navigator']['onLine'] | Nullish;
	'bind:scrollX'?: Window['scrollX'] | Nullish;
	'bind:scrollY'?: Window['scrollY'] | Nullish;
}

export interface SvelteDocumentAttributes extends Handlers<DocumentEventMap, Document> {
	readonly 'bind:activeElement'?: Document['activeElement'] | Nullish;
	readonly 'bind:fullscreenElement'?: Document['fullscreenElement'] | Nullish;
	readonly 'bind:pointerLockElement'?: Document['pointerLockElement'] | Nullish;
	readonly 'bind:visibilityState'?: Document['visibilityState'] | Nullish;
	[key: symbol]: Attachment<Document> | false | Nullish;
}

interface SvelteBoundaryAttributes {
	onerror?: ((error: unknown, reset: () => void) => void) | Nullish;
	failed?: Snippet<[error: unknown, reset: () => void]> | Nullish;
	pending?: Snippet | Nullish;
	children?: Snippet;
}

interface SvelteOptionsAttributes {
	customElement?:
		| string
		| {
				tag?: string;
				shadow?: 'open' | 'none' | ShadowRootInit;
				props?: Record<
					string,
					{
						attribute?: string;
						reflect?: boolean;
						type?: 'Array' | 'Boolean' | 'Number' | 'Object' | 'String';
					}
				>;
				extend?: (base: typeof HTMLElement) => typeof HTMLElement;
		  }
		| Nullish;
	namespace?: 'html' | 'svg' | 'mathml' | Nullish;
	css?: 'injected' | Nullish;
	runes?: true | Nullish;
	preserveWhitespace?: boolean | Nullish;
	[name: string]: any;
}

export interface SVGAttributes<T extends EventTarget>
	extends
		AriaAttributes,
		Omit<DOMAttributes<T>, keyof Handlers<HTMLElementEventMap, T>>,
		Handlers<SVGElementEventMap, T>,
		ElementBindings {
	class?: ClassValue | Nullish;
	id?: string | Nullish;
	lang?: string | Nullish;
	role?: AriaRole | Nullish;
	style?: string | Nullish;
	tabindex?: number | Nullish;
	autofocus?: boolean | Nullish;
	nonce?: string | Nullish;
	part?: string | Nullish;
	slot?: string | Nullish;
	xmlns?: string | Nullish;
	'xmlns:xlink'?: string | Nullish;
	'xml:base'?: string | Nullish;
	'xml:lang'?: string | Nullish;
	'xml:space'?: 'default' | 'preserve' | Nullish;

	'alignment-baseline'?: string | Nullish;
	'baseline-shift'?: Numberish | Nullish;
	clip?: Numberish | Nullish;
	'clip-path'?: string | Nullish;
	'clip-rule'?: 'nonzero' | 'evenodd' | 'inherit' | Nullish;
	color?: string | Nullish;
	'color-interpolation'?: string | Nullish;
	'color-interpolation-filters'?: 'auto' | 'sRGB' | 'linearRGB' | 'inherit' | Nullish;
	'color-profile'?: Numberish | Nullish;
	'color-rendering'?: Numberish | Nullish;
	cursor?: Numberish | Nullish;
	direction?: Numberish | Nullish;
	display?: Numberish | Nullish;
	'dominant-baseline'?: Numberish | Nullish;
	'enable-background'?: Numberish | Nullish;
	fill?: string | Nullish;
	'fill-opacity'?: Numberish | Nullish;
	'fill-rule'?: 'nonzero' | 'evenodd' | 'inherit' | Nullish;
	filter?: string | Nullish;
	'flood-color'?: Numberish | Nullish;
	'flood-opacity'?: Numberish | Nullish;
	'font-family'?: string | Nullish;
	'font-size'?: Numberish | Nullish;
	'font-size-adjust'?: Numberish | Nullish;
	'font-stretch'?: Numberish | Nullish;
	'font-style'?: Numberish | Nullish;
	'font-variant'?: Numberish | Nullish;
	'font-weight'?: Numberish | Nullish;
	'glyph-orientation-horizontal'?: Numberish | Nullish;
	'glyph-orientation-vertical'?: Numberish | Nullish;
	'image-rendering'?: Numberish | Nullish;
	kerning?: Numberish | Nullish;
	'letter-spacing'?: Numberish | Nullish;
	'lighting-color'?: Numberish | Nullish;
	'marker-end'?: string | Nullish;
	'marker-mid'?: string | Nullish;
	'marker-start'?: string | Nullish;
	mask?: string | Nullish;
	opacity?: Numberish | Nullish;
	overflow?: Numberish | Nullish;
	'paint-order'?: Numberish | Nullish;
	'pointer-events'?: Numberish | Nullish;
	'shape-rendering'?: Numberish | Nullish;
	'stop-color'?: string | Nullish;
	'stop-opacity'?: Numberish | Nullish;
	stroke?: string | Nullish;
	'stroke-dasharray'?: Numberish | Nullish;
	'stroke-dashoffset'?: Numberish | Nullish;
	'stroke-linecap'?: 'butt' | 'round' | 'square' | 'inherit' | Nullish;
	'stroke-linejoin'?: 'arcs' | 'bevel' | 'miter' | 'miter-clip' | 'round' | 'inherit' | Nullish;
	'stroke-miterlimit'?: Numberish | Nullish;
	'stroke-opacity'?: Numberish | Nullish;
	'stroke-width'?: Numberish | Nullish;
	'text-anchor'?: string | Nullish;
	'text-decoration'?: Numberish | Nullish;
	'text-rendering'?: Numberish | Nullish;
	transform?: string | Nullish;
	'transform-origin'?: string | Nullish;
	'unicode-bidi'?: Numberish | Nullish;
	'vector-effect'?: Numberish | Nullish;
	visibility?: Numberish | Nullish;
	'word-spacing'?: Numberish | Nullish;
	'writing-mode'?: Numberish | Nullish;

	x?: Numberish | Nullish;
	y?: Numberish | Nullish;
	x1?: Numberish | Nullish;
	x2?: Numberish | Nullish;
	y1?: Numberish | Nullish;
	y2?: Numberish | Nullish;
	cx?: Numberish | Nullish;
	cy?: Numberish | Nullish;
	r?: Numberish | Nullish;
	rx?: Numberish | Nullish;
	ry?: Numberish | Nullish;
	fx?: Numberish | Nullish;
	fy?: Numberish | Nullish;
	fr?: Numberish | Nullish;
	width?: Numberish | Nullish;
	height?: Numberish | Nullish;
	d?: string | Nullish;
	points?: string | Nullish;
	pathLength?: Numberish | Nullish;
	viewBox?: string | Nullish;
	preserveAspectRatio?: string | Nullish;
	href?: string | Nullish;
	target?: string | Nullish;
	type?: string | Nullish;
	offset?: Numberish | Nullish;
	version?: string | Nullish;
	focusable?: Booleanish | 'auto' | Nullish;
	requiredExtensions?: Numberish | Nullish;
	systemLanguage?: Numberish | Nullish;
	crossorigin?: CrossOrigin;
	decoding?: 'async' | 'auto' | 'sync' | Nullish;
	'xlink:actuate'?: string | Nullish;
	'xlink:arcrole'?: string | Nullish;
	'xlink:href'?: string | Nullish;
	'xlink:role'?: string | Nullish;
	'xlink:show'?: string | Nullish;
	'xlink:title'?: string | Nullish;
	'xlink:type'?: string | Nullish;

	gradientTransform?: string | Nullish;
	gradientUnits?: string | Nullish;
	spreadMethod?: string | Nullish;
	patternContentUnits?: string | Nullish;
	patternTransform?: Numberish | Nullish;
	patternUnits?: string | Nullish;
	markerHeight?: Numberish | Nullish;
	markerUnits?: Numberish | Nullish;
	markerWidth?: Numberish | Nullish;
	orient?: Numberish | Nullish;
	refX?: Numberish | Nullish;
	refY?: Numberish | Nullish;
	maskContentUnits?: Numberish | Nullish;
	maskUnits?: Numberish | Nullish;
	clipPathUnits?: Numberish | Nullish;
	filterUnits?: Numberish | Nullish;
	primitiveUnits?: Numberish | Nullish;

	in?: string | Nullish;
	in2?: Numberish | Nullish;
	result?: string | Nullish;
	operator?: Numberish | Nullish;
	mode?: Numberish | Nullish;
	values?: string | Nullish;
	stdDeviation?: Numberish | Nullish;
	dx?: Numberish | Nullish;
	dy?: Numberish | Nullish;
	k?: Numberish | Nullish;
	k1?: Numberish | Nullish;
	k2?: Numberish | Nullish;
	k3?: Numberish | Nullish;
	k4?: Numberish | Nullish;
	kernelMatrix?: Numberish | Nullish;
	kernelUnitLength?: Numberish | Nullish;
	order?: Numberish | Nullish;
	divisor?: Numberish | Nullish;
	bias?: Numberish | Nullish;
	targetX?: Numberish | Nullish;
	targetY?: Numberish | Nullish;
	edgeMode?: Numberish | Nullish;
	preserveAlpha?: Booleanish | Nullish;
	surfaceScale?: Numberish | Nullish;
	diffuseConstant?: Numberish | Nullish;
	specularConstant?: Numberish | Nullish;
	specularExponent?: Numberish | Nullish;
	azimuth?: Numberish | Nullish;
	elevation?: Numberish | Nullish;
	pointsAtX?: Numberish | Nullish;
	pointsAtY?: Numberish | Nullish;
	pointsAtZ?: Numberish | Nullish;
	z?: Numberish | Nullish;
	limitingConeAngle?: Numberish | Nullish;
	scale?: Numberish | Nullish;
	xChannelSelector?: string | Nullish;
	yChannelSelector?: string | Nullish;
	baseFrequency?: Numberish | Nullish;
	numOctaves?: Numberish | Nullish;
	seed?: Numberish | Nullish;
	stitchTiles?: Numberish | Nullish;
	radius?: Numberish | Nullish;
	tableValues?: Numberish | Nullish;
	slope?: Numberish | Nullish;
	intercept?: Numberish | Nullish;
	amplitude?: Numberish | Nullish;
	exponent?: Numberish | Nullish;

	rotate?: Numberish | Nullish;
	lengthAdjust?: Numberish | Nullish;
	textLength?: Numberish | Nullish;
	startOffset?: Numberish | Nullish;
	method?: string | Nullish;
	spacing?: Numberish | Nullish;
	side?: 'left' | 'right' | Nullish;
	path?: string | Nullish;

	attributeName?: string | Nullish;
	attributeType?: string | Nullish;
	additive?: 'replace' | 'sum' | Nullish;
	accumulate?: 'none' | 'sum' | Nullish;
	begin?: Numberish | Nullish;
	end?: Numberish | Nullish;
	dur?: Numberish | Nullish;
	min?: Numberish | Nullish;
	max?: Numberish | Nullish;
	restart?: 'always' | 'whenNotActive' | 'never' | Nullish;
	repeatCount?: Numberish | Nullish;
	repeatDur?: Numberish | Nullish;
	calcMode?: Numberish | Nullish;
	keyPoints?: Numberish | Nullish;
	keySplines?: Numberish | Nullish;
	keyTimes?: Numberish | Nullish;
	from?: Numberish | Nullish;
	to?: Numberish | Nullish;
	by?: Numberish | Nullish;

	[key: `data-${string}`]: any;
}

type HTMLDefaults = {
	[K in keyof HTMLElementTagNameMap]: HTMLAttributes<HTMLElementTagNameMap[K]>;
};

type SVGDefaults = {
	[K in Exclude<keyof SVGElementTagNameMap, keyof HTMLElementTagNameMap>]: SVGAttributes<
		SVGElementTagNameMap[K]
	>;
};

export interface SvelteHTMLElements extends HTMLDefaults, SVGDefaults {
	a: HTMLAnchorAttributes;
	area: HTMLAreaAttributes;
	audio: HTMLAudioAttributes;
	base: HTMLBaseAttributes;
	big: HTMLAttributes<HTMLElement>;
	blockquote: HTMLBlockquoteAttributes;
	button: HTMLButtonAttributes;
	canvas: HTMLCanvasAttributes;
	col: HTMLColAttributes;
	colgroup: HTMLColgroupAttributes;
	data: HTMLDataAttributes;
	del: HTMLDelAttributes;
	details: HTMLDetailsAttributes;
	dialog: HTMLDialogAttributes;
	embed: HTMLEmbedAttributes;
	fieldset: HTMLFieldsetAttributes;
	form: HTMLFormAttributes;
	html: HTMLHtmlAttributes;
	iframe: HTMLIframeAttributes;
	img: HTMLImgAttributes;
	input: HTMLInputAttributes;
	ins: HTMLInsAttributes;
	keygen: HTMLKeygenAttributes;
	label: HTMLLabelAttributes;
	li: HTMLLiAttributes;
	link: HTMLLinkAttributes;
	map: HTMLMapAttributes;
	menu: HTMLMenuAttributes;
	meta: HTMLMetaAttributes;
	meter: HTMLMeterAttributes;
	object: HTMLObjectAttributes;
	ol: HTMLOlAttributes;
	optgroup: HTMLOptgroupAttributes;
	option: HTMLOptionAttributes;
	output: HTMLOutputAttributes;
	param: HTMLParamAttributes;
	progress: HTMLProgressAttributes;
	q: HTMLQuoteAttributes;
	script: HTMLScriptAttributes;
	select: HTMLSelectAttributes;
	slot: HTMLSlotAttributes;
	source: HTMLSourceAttributes;
	style: HTMLStyleAttributes;
	table: HTMLTableAttributes;
	td: HTMLTdAttributes;
	template: HTMLTemplateAttributes;
	textarea: HTMLTextareaAttributes;
	th: HTMLThAttributes;
	time: HTMLTimeAttributes;
	track: HTMLTrackAttributes;
	video: HTMLVideoAttributes;

	'svelte:window': SvelteWindowAttributes;
	'svelte:document': SvelteDocumentAttributes;
	'svelte:body': HTMLAttributes<HTMLElement>;
	'svelte:boundary': SvelteBoundaryAttributes;
	'svelte:head': { [name: string]: never };
	'svelte:options': SvelteOptionsAttributes;

	[name: string]: { [name: string]: any };
}
