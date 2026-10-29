import type * as ES from 'estree';

export interface Located {
	start: number;
	end: number;
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

export type Expression = ES.Expression & Partial<Located>;

export type Pattern = ES.Pattern & Partial<Located>;

export interface JSComment extends Located {
	type: 'Line' | 'Block';
	value: string;
	loc?: { start: { line: number; column: number }; end: { line: number; column: number } };
}

export interface Fragment {
	type: 'Fragment';
	nodes: TemplateNode[];
}

export interface Text extends Located {
	type: 'Text';
	raw: string;
	data: string;
}

export interface Comment extends Located {
	type: 'Comment';
	data: string;
}

export interface ExpressionTag extends Located {
	type: 'ExpressionTag';
	expression: Expression;
}

export interface HtmlTag extends Located {
	type: 'HtmlTag';
	expression: Expression;
}

export interface ConstTag extends Located {
	type: 'ConstTag';
	declaration: ES.VariableDeclaration &
		Located & { declarations: [ES.VariableDeclarator & Located] };
}

export interface DeclarationTag extends Located {
	type: 'DeclarationTag';
	declaration: ES.VariableDeclaration & Located;
}

export interface DebugTag extends Located {
	type: 'DebugTag';
	identifiers: (ES.Identifier & Located)[];
}

export interface RenderTag extends Located {
	type: 'RenderTag';
	expression: (ES.SimpleCallExpression | ES.ChainExpression) & Located;
}

export interface AttachTag extends Located {
	type: 'AttachTag';
	expression: Expression;
}

export type AttributeValue = true | ExpressionTag | (Text | ExpressionTag)[];

export interface Attribute extends Located {
	type: 'Attribute';
	name: string;
	name_loc: NameLocation | null;
	value: AttributeValue;
}

export interface SpreadAttribute extends Located {
	type: 'SpreadAttribute';
	expression: Expression;
}

export type DirectiveType =
	| 'AnimateDirective'
	| 'BindDirective'
	| 'ClassDirective'
	| 'LetDirective'
	| 'OnDirective'
	| 'TransitionDirective'
	| 'UseDirective';

export interface Directive extends Located {
	type: DirectiveType;
	name: string;
	name_loc: NameLocation | null;
	expression: Expression | null;
	modifiers: string[];
	intro?: boolean;
	outro?: boolean;
}

export interface StyleDirective extends Located {
	type: 'StyleDirective';
	name: string;
	name_loc: NameLocation | null;
	modifiers: string[];
	value: AttributeValue;
}

export type AttributeLike = Attribute | SpreadAttribute | Directive | StyleDirective | AttachTag;

export type ElementType =
	| 'RegularElement'
	| 'Component'
	| 'TitleElement'
	| 'SlotElement'
	| 'SvelteHead'
	| 'SvelteOptions'
	| 'SvelteWindow'
	| 'SvelteDocument'
	| 'SvelteBody'
	| 'SvelteElement'
	| 'SvelteComponent'
	| 'SvelteSelf'
	| 'SvelteFragment'
	| 'SvelteBoundary';

export interface ElementLike extends Located {
	type: ElementType;
	name: string;
	name_loc: NameLocation;
	attributes: AttributeLike[];
	fragment: Fragment;
	tag?: Expression;
	expression?: Expression;
}

export interface IfBlock extends Located {
	type: 'IfBlock';
	elseif: boolean;
	test: Expression;
	consequent: Fragment;
	alternate: Fragment | null;
}

export interface EachBlock extends Located {
	type: 'EachBlock';
	expression: Expression;
	context: Pattern | null;
	body: Fragment;
	fallback?: Fragment;
	index?: string;
	key?: Expression;
}

export interface AwaitBlock extends Located {
	type: 'AwaitBlock';
	expression: Expression;
	value: Pattern | null;
	error: Pattern | null;
	pending: Fragment | null;
	then: Fragment | null;
	catch: Fragment | null;
}

export interface KeyBlock extends Located {
	type: 'KeyBlock';
	expression: Expression;
	fragment: Fragment;
}

export interface SnippetBlock extends Located {
	type: 'SnippetBlock';
	expression: ES.Identifier & Located;
	typeParams?: string;
	parameters: Pattern[];
	body: Fragment;
}

export type Tag = ExpressionTag | HtmlTag | ConstTag | DeclarationTag | DebugTag | RenderTag;

export type Block = IfBlock | EachBlock | AwaitBlock | KeyBlock | SnippetBlock;

export type TemplateNode = Text | Comment | Tag | Block | ElementLike;

export interface Script extends Located {
	type: 'Script';
	context: 'default' | 'module';
	content: ES.Program & Located;
	attributes: AttributeLike[];
}

export interface CustomElementProp {
	type?: 'String' | 'Number' | 'Boolean' | 'Array' | 'Object';
	reflect?: boolean;
	attribute?: string;
}

export interface CustomElementOptions {
	tag?: string;
	shadow?: 'open' | 'none' | ES.ObjectExpression;
	props?: Record<string, CustomElementProp>;
	extend?: Expression;
}

export interface SvelteOptions extends Located {
	attributes: AttributeLike[];
	runes?: boolean;
	immutable?: boolean;
	accessors?: boolean;
	preserveWhitespace?: boolean;
	namespace?: 'html' | 'svg' | 'mathml';
	css?: 'injected';
	customElement?: CustomElementOptions;
}

export interface Root extends Located {
	type: 'Root';
	css: Css.StyleSheet | null;
	js: never[];
	fragment: Fragment;
	options: SvelteOptions | null;
	comments: JSComment[];
	instance?: Script;
	module?: Script;
}

export namespace Css {
	export interface Comment extends Located {
		type: 'CSSComment';
		value: string;
		position?: number;
	}

	export interface StyleSheet extends Located {
		type: 'StyleSheet';
		attributes: AttributeLike[];
		children: (Rule | Atrule)[];
		comments: Comment[];
		content: {
			start: number;
			end: number;
			styles: string;
			comment: import('./ast.ts').Comment | null;
		};
	}

	export interface Atrule extends Located {
		type: 'Atrule';
		name: string;
		prelude: string;
		block: Block | null;
	}

	export interface Rule extends Located {
		type: 'Rule';
		prelude: SelectorList;
		block: Block;
	}

	export interface SelectorList extends Located {
		type: 'SelectorList';
		children: ComplexSelector[];
	}

	export interface ComplexSelector extends Located {
		type: 'ComplexSelector';
		children: RelativeSelector[];
	}

	export interface RelativeSelector extends Located {
		type: 'RelativeSelector';
		combinator: Combinator | null;
		selectors: SimpleSelector[];
	}

	export interface Combinator extends Located {
		type: 'Combinator';
		name: string;
	}

	export interface Named extends Located {
		name: string;
	}

	export interface TypeSelector extends Named {
		type: 'TypeSelector';
		namespace?: string;
	}

	export interface IdSelector extends Named {
		type: 'IdSelector';
	}

	export interface ClassSelector extends Named {
		type: 'ClassSelector';
	}

	export interface NestingSelector extends Named {
		type: 'NestingSelector';
	}

	export interface PseudoElementSelector extends Named {
		type: 'PseudoElementSelector';
		args?: SelectorList;
	}

	export interface PseudoClassSelector extends Named {
		type: 'PseudoClassSelector';
		args: SelectorList | null;
	}

	export interface AttributeSelector extends Named {
		type: 'AttributeSelector';
		matcher: string | null;
		value: string | null;
		flags: string | null;
	}

	export interface Nth extends Located {
		type: 'Nth';
		value: string;
	}

	export interface Percentage extends Located {
		type: 'Percentage';
		value: string;
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

	export interface Block extends Located {
		type: 'Block';
		children: (Declaration | Rule | Atrule)[];
	}

	export interface Declaration extends Located {
		type: 'Declaration';
		property: string;
		value: string;
	}

	export interface StyleSheetFile extends Located {
		type: 'StyleSheetFile';
		children: (Rule | Atrule)[];
		comments: Comment[];
	}
}
