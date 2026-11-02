import type * as ES from 'estree';

export interface ClientExpression {
	readonly original: ES.Expression;
	readonly lowered: ES.Expression;
	readonly runtime: ES.Identifier;
}

export type ExpressionProjection = (expression: ClientExpression) => ES.Expression;

export interface RuntimeNames {
	readonly [operation: string]: string;
}

export interface Runtime {
	readonly client: string;
	readonly server: string;
	readonly names?: RuntimeNames;
}
