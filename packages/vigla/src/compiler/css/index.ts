import type { SourceMap } from 'magic-string';
import { Report } from '../analysis/validate/report.ts';
import type { ComponentUnit, Diagnostic } from '../ir/port.ts';
import type * as S from '../ir/style.ts';
import { Analysis } from './analyze.ts';
import { isKeyframes, Marks } from './marks.ts';
import { Pruning } from './prune.ts';
import { Renderer } from './render.ts';
import { TemplateIndex, type Host } from './template.ts';

export { hash } from './hash.ts';
export type { Host } from './template.ts';

export interface Scoping {
	readonly hash: string;
	readonly scoped: ReadonlySet<Host>;
}

export interface StyleOptions {
	readonly hash: string;
}

export interface StyleAnalysis {
	readonly unit: ComponentUnit;
	readonly scoping: Scoping;
	readonly hasGlobal: boolean;
	readonly warnings: readonly Diagnostic[];
	readonly keyframes: readonly string[];
	readonly marks: Marks;
}

export interface RenderOptions {
	readonly dev: boolean;
	readonly inject: boolean;
	readonly outputFilename: string | null;
}

export interface Stylesheet {
	readonly code: string;
	readonly map: SourceMap;
	readonly hasGlobal: boolean;
}

function unused(sheet: S.StyleSheet, marks: Marks, report: Report): void {
	const content = sheet.content;
	const complex = (node: S.ComplexSelector, outer: S.ComplexSelector | null): void => {
		if (!marks.complex(node).used && (outer === null || marks.complex(outer).used)) {
			const text = content.styles.substring(node.start - content.start, node.end - content.start);
			report.warn('css_unused_selector', node, { name: text });
		}
		for (const relative of node.children) {
			for (const selector of relative.selectors) {
				if (
					selector.type === 'PseudoClassSelector' &&
					(selector.name === 'is' || selector.name === 'where') &&
					selector.args !== null
				) {
					for (const inner of selector.args.children) complex(inner, node);
				}
			}
		}
	};
	const child = (node: S.Rule | S.Atrule | S.Declaration): void => {
		if (node.type === 'Atrule') {
			if (!isKeyframes(node) && node.block !== null) node.block.children.forEach(child);
		} else if (node.type === 'Rule') {
			for (const selector of node.prelude.children) complex(selector, null);
			if (!marks.rule(node).isGlobalBlock) node.block.children.forEach(child);
		}
	};
	sheet.children.forEach(child);
}

function exportsSnippet(unit: ComponentUnit): boolean {
	if (unit.module === null) return false;
	const snippets = new Set<string>();
	for (const node of unit.template.nodes) if (node.kind === 'snippet') snippets.add(node.name.name);
	return unit.module.body.some(
		(statement) =>
			statement.type === 'ExportNamedDeclaration' &&
			statement.source == null &&
			statement.specifiers.some(
				(specifier) => specifier.local.type === 'Identifier' && snippets.has(specifier.local.name)
			)
	);
}

export function analyzeStyle(unit: ComponentUnit, options: StyleOptions): StyleAnalysis {
	const marks = new Marks();
	const sheet = unit.style ?? null;
	if (sheet === null) {
		return {
			unit,
			scoping: { hash: options.hash, scoped: new Set() },
			hasGlobal: false,
			warnings: [],
			keyframes: [],
			marks
		};
	}
	const analysis = new Analysis(marks);
	analysis.sheet(sheet);
	const pruning = new Pruning(marks, new TemplateIndex(unit));
	pruning.sheet(sheet);
	const report = new Report(unit.ignores);
	if (!(unit.ignores.get(sheet)?.has('css_unused_selector') ?? false)) unused(sheet, marks, report);
	return {
		unit,
		scoping: { hash: options.hash, scoped: pruning.scoped },
		hasGlobal: analysis.hasGlobal || exportsSnippet(unit),
		warnings: report.warnings,
		keyframes: analysis.keyframes,
		marks
	};
}

export function injected(style: StyleAnalysis, inject: boolean): boolean {
	return inject || style.unit.options?.css === 'injected';
}

export function renderStyle(style: StyleAnalysis, options: RenderOptions): Stylesheet | null {
	const sheet = style.unit.style ?? null;
	if (sheet === null) return null;
	const rendered = new Renderer(style.marks, {
		source: style.unit.source,
		hash: style.scoping.hash,
		minify: options.inject && !options.dev,
		dev: options.dev,
		keyframes: style.keyframes,
		filename: style.unit.filename,
		outputFilename: options.outputFilename
	}).render(sheet);
	let code = rendered.code;
	if (options.dev && options.inject && code !== '') {
		code += `\n/*# sourceMappingURL=${rendered.map.toUrl()} */`;
	}
	return { code, map: rendered.map, hasGlobal: style.hasGlobal };
}
