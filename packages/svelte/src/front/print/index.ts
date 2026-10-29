import { print as render, type Visitors } from 'esrap';
import ts from 'esrap/languages/ts';
import type * as AST from '../ast.ts';
import { cssVisitors } from './css.ts';
import type { State } from './layout.ts';
import { templateVisitors } from './template.ts';

export interface PrintOptions {
	indent?: string;
	getLeadingComments?: (node: unknown) => unknown[] | undefined;
	getTrailingComments?: (node: unknown) => unknown[] | undefined;
}

export interface Printed {
	code: string;
	map: unknown;
}

type Printable = { type: string; comments?: AST.JSComment[]; css?: AST.Css.StyleSheet | null };

export function print(ast: Printable, options?: PrintOptions): Printed {
	const comments = (ast.type === 'Root' && ast.comments) || [];
	const css =
		(ast.type === 'Root'
			? ast.css?.comments
			: ast.type === 'StyleSheet'
				? (ast as unknown as AST.Css.StyleSheet).comments
				: null) ?? [];
	const state: State = { preserve: 0 };
	const visitors = {
		...ts({
			comments,
			getLeadingComments: options?.getLeadingComments,
			getTrailingComments: options?.getTrailingComments
		} as Parameters<typeof ts>[0]),
		...templateVisitors(comments, state),
		...cssVisitors(css, comments)
	} as Visitors;
	return render(ast, visitors, { indent: options?.indent });
}
