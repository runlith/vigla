import type * as ES from 'estree';

export interface Span {
	readonly start: number;
	readonly end: number;
}

export interface Fragment {
	readonly nodes: readonly Node[];
}

export type Node =
	| Text
	| Comment
	| Expression
	| Element
	| Component
	| DynamicElement
	| Branch
	| KeyedList
	| UnkeyedList
	| KeyedBlock
	| AsyncBlock
	| Boundary
	| Snippet
	| Render
	| RawHtml
	| Constant
	| Debug
	| Title
	| Special
	| Slot;

export interface Text extends Span {
	readonly kind: 'text';
	readonly data: string;
}

export interface Comment extends Span {
	readonly kind: 'comment';
	readonly data: string;
}

export interface Expression extends Span {
	readonly kind: 'expression';
	readonly expression: ES.Expression;
}

export interface Element extends Span {
	readonly kind: 'element';
	readonly name: string;
	readonly attributes: readonly Attribute[];
	readonly body: Fragment;
}

export interface Component extends Span {
	readonly kind: 'component';
	readonly reference: ES.Expression;
	readonly attributes: readonly Attribute[];
	readonly body: Fragment;
}

export interface DynamicElement extends Span {
	readonly kind: 'dynamic-element';
	readonly tag: ES.Expression;
	readonly namespace: ES.Expression | null;
	readonly attributes: readonly Attribute[];
	readonly body: Fragment;
}

export interface Arm extends Span {
	readonly test: ES.Expression;
	readonly body: Fragment;
}

export interface Branch extends Span {
	readonly kind: 'branch';
	readonly arms: readonly Arm[];
	readonly fallback: Fragment | null;
}

export interface List extends Span {
	readonly collection: ES.Expression;
	readonly item: ES.Pattern | null;
	readonly index: ES.Identifier | null;
	readonly body: Fragment;
	readonly fallback: Fragment | null;
}

export interface KeyedList extends List {
	readonly kind: 'keyed-list';
	readonly key: ES.Expression;
}

export interface UnkeyedList extends List {
	readonly kind: 'unkeyed-list';
}

export interface KeyedBlock extends Span {
	readonly kind: 'keyed-block';
	readonly key: ES.Expression;
	readonly body: Fragment;
}

export interface Outcome {
	readonly binding: ES.Pattern | null;
	readonly body: Fragment;
}

export interface AsyncBlock extends Span {
	readonly kind: 'async-block';
	readonly promise: ES.Expression;
	readonly pending: Fragment | null;
	readonly resolved: Outcome | null;
	readonly rejected: Outcome | null;
}

export interface Boundary extends Span {
	readonly kind: 'boundary';
	readonly attributes: readonly Attribute[];
	readonly body: Fragment;
}

export interface Snippet extends Span {
	readonly kind: 'snippet';
	readonly name: ES.Identifier;
	readonly parameters: readonly ES.Pattern[];
	readonly body: Fragment;
}

export interface Render extends Span {
	readonly kind: 'render';
	readonly call: ES.SimpleCallExpression | ES.ChainExpression;
}

export interface RawHtml extends Span {
	readonly kind: 'raw-html';
	readonly expression: ES.Expression;
}

export interface Constant extends Span {
	readonly kind: 'constant';
	readonly declarator: ES.VariableDeclarator;
}

export interface Debug extends Span {
	readonly kind: 'debug';
	readonly identifiers: readonly ES.Identifier[];
}

export interface Title extends Span {
	readonly kind: 'title';
	readonly parts: readonly (Text | Expression)[];
}

export type Target = 'head' | 'window' | 'document' | 'body';

export interface Special extends Span {
	readonly kind: 'special';
	readonly target: Target;
	readonly attributes: readonly Attribute[];
	readonly body: Fragment;
}

export interface Slot extends Span {
	readonly kind: 'slot';
	readonly name: string | null;
	readonly attributes: readonly Attribute[];
	readonly fallback: Fragment;
}

export type Attribute =
	| Property
	| Spread
	| Binding
	| ClassToggle
	| StyleProperty
	| Action
	| Transition
	| Animation
	| Attachment;

export type Value =
	| { readonly kind: 'boolean' }
	| { readonly kind: 'expression'; readonly expression: ES.Expression }
	| { readonly kind: 'text'; readonly parts: readonly (Text | Expression)[] };

export interface Property extends Span {
	readonly kind: 'attribute';
	readonly name: string;
	readonly value: Value;
}

export interface Spread extends Span {
	readonly kind: 'spread';
	readonly expression: ES.Expression;
}

export interface Binding extends Span {
	readonly kind: 'binding';
	readonly name: string;
	readonly expression: ES.Expression;
}

export interface ClassToggle extends Span {
	readonly kind: 'class';
	readonly name: string;
	readonly expression: ES.Expression;
}

export interface StyleProperty extends Span {
	readonly kind: 'style';
	readonly name: string;
	readonly value: Value;
	readonly important: boolean;
}

export interface Action extends Span {
	readonly kind: 'action';
	readonly action: ES.Expression;
	readonly argument: ES.Expression | null;
}

export interface Transition extends Span {
	readonly kind: 'transition';
	readonly direction: 'both' | 'in' | 'out';
	readonly transition: ES.Expression;
	readonly argument: ES.Expression | null;
	readonly global: boolean;
}

export interface Animation extends Span {
	readonly kind: 'animation';
	readonly animation: ES.Expression;
	readonly argument: ES.Expression | null;
}

export interface Attachment extends Span {
	readonly kind: 'attachment';
	readonly expression: ES.Expression;
}

export type Namespace = 'html' | 'svg' | 'mathml';

export interface CustomElement {
	readonly tag: string | null;
	readonly shadow: 'open' | 'none' | ES.ObjectExpression | null;
	readonly props: ES.ObjectExpression | null;
	readonly extend: ES.Expression | null;
}

export interface Options extends Span {
	readonly namespace: Namespace | null;
	readonly css: 'injected' | null;
	readonly customElement: CustomElement | null;
	readonly preserveWhitespace: boolean | null;
}
