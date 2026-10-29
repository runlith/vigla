import { existsSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { parse, print, type AST } from 'svelte/compiler';
import { assert } from 'vitest';
import { walk } from 'zimmerframe';
import type { Base } from '../runtime/config.ts';
import type { Plain, Sample } from '../samples.ts';
import { readJson } from './diagnostics.ts';

type Json = Record<string, unknown>;

function input(cwd: string): string {
	return readFileSync(`${cwd}/input.svelte`, 'utf8').replace(/\s+$/, '').replace(/\r/g, '');
}

function json(value: unknown): Json {
	return JSON.parse(JSON.stringify(value)) as Json;
}

function loose(cwd: string): boolean {
	return basename(cwd).startsWith('loose-');
}

function parseLegacy({ cwd }: Sample<Base>): void {
	const actual = json(parse(input(cwd), { loose: loose(cwd) }));
	assert.deepEqual(actual, readJson<Json>(`${cwd}/output.json`));
}

type Node = AST.SvelteNode & Record<string, unknown>;

function clean(ast: Json): Json {
	return walk(ast as unknown as Node, null, {
		_(node, context) {
			const bare = node as Record<string, unknown>;
			delete bare.start;
			delete bare.end;
			delete bare.loc;
			delete bare.name_loc;
			delete bare.leadingComments;
			delete bare.trailingComments;
			context.next();
		},
		StyleSheet(node, context) {
			const sheet = node as unknown as AST.CSS.StyleSheet;
			return {
				type: sheet.type,
				attributes: sheet.attributes.map((attribute) => context.visit(attribute as Node)),
				children: sheet.children.map((child) => context.visit(child as unknown as Node)),
				content: {}
			} as unknown as Node;
		},
		Fragment(node, context) {
			const fragment = node as unknown as AST.Fragment;
			const nodes: Node[] = [];
			for (let i = 0; i < fragment.nodes.length; i += 1) {
				let child = fragment.nodes[i] as Node;
				if (child.type === 'Text') {
					const text = child as unknown as AST.Text;
					const trimmed = {
						...text,
						data: text.data.replace(/[^\S]+/g, ' '),
						raw: text.raw.replace(/[^\S]+/g, ' ')
					};
					if (i === 0) {
						trimmed.data = trimmed.data.trimStart();
						trimmed.raw = trimmed.raw.trimStart();
					}
					if (i === fragment.nodes.length - 1) {
						trimmed.data = trimmed.data.trimEnd();
						trimmed.raw = trimmed.raw.trimEnd();
					}
					if (trimmed.data === '') continue;
					child = trimmed as unknown as Node;
				}
				nodes.push(context.visit(child));
			}
			return { ...fragment, nodes } as unknown as Node;
		}
	}) as unknown as Json;
}

function parseModern({ cwd }: Sample<Base>): void {
	const isLoose = loose(cwd);
	const actual = json(parse(input(cwd), { modern: true, loose: isLoose }));
	const expected = readJson<Json>(`${cwd}/output.json`);
	if (!expected?.comments) delete actual.comments;
	assert.deepEqual(actual, expected);

	if (isLoose) return;
	const printed = print(actual as unknown as AST.Root);
	const reparsed = json(parse(printed.code, { modern: true, loose: isLoose }));
	if (!actual.comments) delete reparsed.comments;
	assert.deepEqual(clean(actual), clean(reparsed));
}

export const parserLegacy: Plain<Base> = { run: parseLegacy };

export const parserModern: Plain<Base> = {
	run: parseModern,
	tests: {
		'Strips BOM from the input': {
			run: () => {
				const actual = parse('﻿<div></div>', { modern: true });
				assert.deepEqual(json(actual.fragment), {
					type: 'Fragment',
					nodes: [
						{
							attributes: [],
							end: 11,
							fragment: { nodes: [], type: 'Fragment' },
							name_loc: {
								end: { character: 4, column: 4, line: 1 },
								start: { character: 1, column: 1, line: 1 }
							},
							name: 'div',
							start: 0,
							type: 'RegularElement'
						}
					]
				});
			}
		}
	}
};

export const printer: Plain<Base> = {
	run: ({ cwd }) => {
		const output = print(parse(readFileSync(`${cwd}/input.svelte`, 'utf8'), { modern: true }));
		const code = output.code.endsWith('\n') ? output.code : `${output.code}\n`;
		parse(code, { modern: true });
		const file = `${cwd}/output.svelte`;
		const expected = existsSync(file) ? readFileSync(file, 'utf8') : '';
		assert.deepEqual(code.trim().replaceAll('\r', ''), expected.trim().replaceAll('\r', ''));
	}
};
