import type { Span } from './nodes.ts';

export interface StyleSheet extends Span {
	readonly type: 'StyleSheet';
	readonly children: readonly (Rule | Atrule)[];
	readonly content: StyleContent;
}

export interface StyleContent {
	readonly start: number;
	readonly end: number;
	readonly styles: string;
}

export interface Atrule extends Span {
	readonly type: 'Atrule';
	readonly name: string;
	readonly prelude: string;
	readonly block: Block | null;
}

export interface Rule extends Span {
	readonly type: 'Rule';
	readonly prelude: SelectorList;
	readonly block: Block;
}

export interface SelectorList extends Span {
	readonly type: 'SelectorList';
	readonly children: readonly ComplexSelector[];
}

export interface ComplexSelector extends Span {
	readonly type: 'ComplexSelector';
	readonly children: readonly RelativeSelector[];
}

export interface RelativeSelector extends Span {
	readonly type: 'RelativeSelector';
	readonly combinator: Combinator | null;
	readonly selectors: readonly SimpleSelector[];
}

export interface Combinator extends Span {
	readonly type: 'Combinator';
	readonly name: string;
}

export interface TypeSelector extends Span {
	readonly type: 'TypeSelector';
	readonly name: string;
	readonly namespace?: string;
}

export interface IdSelector extends Span {
	readonly type: 'IdSelector';
	readonly name: string;
}

export interface ClassSelector extends Span {
	readonly type: 'ClassSelector';
	readonly name: string;
}

export interface NestingSelector extends Span {
	readonly type: 'NestingSelector';
	readonly name: string;
}

export interface PseudoElementSelector extends Span {
	readonly type: 'PseudoElementSelector';
	readonly name: string;
	readonly args?: SelectorList;
}

export interface PseudoClassSelector extends Span {
	readonly type: 'PseudoClassSelector';
	readonly name: string;
	readonly args: SelectorList | null;
}

export interface AttributeSelector extends Span {
	readonly type: 'AttributeSelector';
	readonly name: string;
	readonly matcher: string | null;
	readonly value: string | null;
	readonly flags: string | null;
}

export interface Nth extends Span {
	readonly type: 'Nth';
	readonly value: string;
}

export interface Percentage extends Span {
	readonly type: 'Percentage';
	readonly value: string;
}

export type SimpleSelector =
	| TypeSelector
	| IdSelector
	| ClassSelector
	| NestingSelector
	| PseudoElementSelector
	| PseudoClassSelector
	| AttributeSelector
	| Nth
	| Percentage;

export interface Block extends Span {
	readonly type: 'Block';
	readonly children: readonly (Declaration | Rule | Atrule)[];
}

export interface Declaration extends Span {
	readonly type: 'Declaration';
	readonly property: string;
	readonly value: string;
}
