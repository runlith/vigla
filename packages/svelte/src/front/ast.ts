import type * as ES from 'estree';

export interface Located {
	start: number;
	end: number;
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
	expression: ES.Expression;
}

export interface Attribute extends Located {
	type: 'Attribute';
	name: string;
	value: true | ExpressionTag | (Text | ExpressionTag)[];
}

export interface RegularElement extends Located {
	type: 'RegularElement';
	name: string;
	attributes: Attribute[];
	fragment: Fragment;
}

export interface IfBlock extends Located {
	type: 'IfBlock';
	elseif: boolean;
	test: ES.Expression;
	consequent: Fragment;
	alternate: Fragment | null;
}

export interface EachBlock extends Located {
	type: 'EachBlock';
	expression: ES.Expression;
	context: ES.Pattern | null;
	body: Fragment;
	key?: ES.Expression;
}

export type TemplateNode = Text | Comment | ExpressionTag | RegularElement | IfBlock | EachBlock;

export interface Script extends Located {
	type: 'Script';
	context: 'default' | 'module';
	content: ES.Program;
	attributes: Attribute[];
}

export interface Root extends Located {
	type: 'Root';
	fragment: Fragment;
	instance: Script | null;
	module: Script | null;
}
