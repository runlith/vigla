import { builtinModules } from 'node:module';
import { defineProgram, type Finding, type Reading, type Side } from '@runlith/tagma/rules';
import type {
	BuiltinsParams,
	InternalsParams,
	LoadsParams,
	MentionsParams,
	Programs,
	WordsParams
} from './inspections.ts';

const specifier = /(?:\bfrom|\bimport\s*\(|\bimport|\brequire\s*\()\s*(['"`])([^'"`]+)\1/g;

function blank(text: string): string {
	return text.replace(/[^\n]/g, ' ');
}

function code(text: string): string {
	let out = '';
	let index = 0;
	while (index < text.length) {
		const char = text[index] ?? '';
		const next = text[index + 1];
		if (char === '/' && next === '/') {
			const end = text.indexOf('\n', index);
			const stop = end === -1 ? text.length : end;
			out += blank(text.slice(index, stop));
			index = stop;
		} else if (char === '/' && next === '*') {
			const end = text.indexOf('*/', index + 2);
			const stop = end === -1 ? text.length : end + 2;
			out += blank(text.slice(index, stop));
			index = stop;
		} else if (char === '"' || char === "'" || char === '`') {
			let stop = index + 1;
			while (stop < text.length && text[stop] !== char) stop += text[stop] === '\\' ? 2 : 1;
			out += text.slice(index, stop + 1);
			index = stop + 1;
		} else {
			out += char;
			index += 1;
		}
	}
	return out;
}

function lineOf(text: string, offset: number): number {
	let line = 1;
	for (let index = 0; index < offset; index++) if (text[index] === '\n') line += 1;
	return line;
}

async function internals(side: Side, params: InternalsParams): Promise<Reading> {
	const patterns = params.patterns.map((pattern) => new RegExp(pattern));
	const findings: Finding[] = [];
	for (const path of side.paths) {
		const text = await side.read(path);
		if (text === null) continue;
		const source = code(text);
		for (const match of source.matchAll(specifier)) {
			const target = match[2] ?? '';
			if (!patterns.some((pattern) => pattern.test(target))) continue;
			findings.push({
				fingerprint: `${target} @ ${path}`,
				path,
				line: lineOf(source, match.index + match[0].length - target.length - 1),
				message: `imports ${target}, an internal of the target`,
				fix: 'Reach the target through its public entries; only a target fresh-state hook in targets/<name> touches internals.'
			});
		}
	}
	return { findings };
}

const referenced = /^\s*\/\/\/\s*<reference\s+types\s*=\s*(['"])([^'"]+)\1/gm;

const dependencyFields = [
	'dependencies',
	'devDependencies',
	'peerDependencies',
	'optionalDependencies'
];

function naming(packages: readonly string[]): (target: string) => boolean {
	return (target) => packages.some((name) => target === name || target.startsWith(`${name}/`));
}

function strings(value: unknown, into: string[] = []): string[] {
	if (typeof value === 'string') into.push(value);
	else if (Array.isArray(value)) for (const item of value) strings(item, into);
	else if (typeof value === 'object' && value !== null)
		for (const item of Object.values(value)) strings(item, into);
	return into;
}

function manifestFindings(
	path: string,
	text: string,
	names: (target: string) => boolean,
	fix: string
): Finding[] {
	const findings: Finding[] = [];
	const parsed = JSON.parse(text) as Record<string, unknown>;
	const at = (needle: string): number => lineOf(text, Math.max(0, text.indexOf(`"${needle}"`)));
	if (path.endsWith('package.json')) {
		for (const field of dependencyFields) {
			const entries = parsed[field];
			if (typeof entries !== 'object' || entries === null) continue;
			for (const key of Object.keys(entries)) {
				if (!names(key)) continue;
				findings.push({
					fingerprint: `${field}.${key} @ ${path}`,
					path,
					line: at(key),
					message: `declares ${key} in ${field}`,
					fix
				});
			}
		}
	}
	for (const value of strings(parsed)) {
		if (!names(value)) continue;
		findings.push({
			fingerprint: `"${value}" @ ${path}`,
			path,
			line: at(value),
			message: `names ${value}`,
			fix
		});
	}
	return findings;
}

interface Literal {
	readonly value: string;
	readonly start: number;
}

function literals(text: string): Literal[] {
	const found: Literal[] = [];
	let index = 0;
	while (index < text.length) {
		const char = text[index] ?? '';
		const next = text[index + 1];
		if (char === '/' && next === '/') {
			const end = text.indexOf('\n', index);
			index = end === -1 ? text.length : end;
		} else if (char === '/' && next === '*') {
			const end = text.indexOf('*/', index + 2);
			index = end === -1 ? text.length : end + 2;
		} else if (char === '"' || char === "'" || char === '`') {
			let stop = index + 1;
			let value = '';
			let plain = true;
			while (stop < text.length && text[stop] !== char) {
				if (text[stop] === '\\') {
					value += text[stop + 1] ?? '';
					stop += 2;
					continue;
				}
				if (char === '`' && text[stop] === '$' && text[stop + 1] === '{') plain = false;
				value += text[stop];
				stop += 1;
			}
			if (plain) found.push({ value, start: index });
			index = stop + 1;
		} else {
			index += 1;
		}
	}
	return found;
}

const specifierPosition = /(?<![.\w$])(?:from|import|import\s*\(|require\s*\()\s*$/;

const modulePosition = /(?<![.\w$])declare\s+module\s*$/;

async function mentions(side: Side, params: MentionsParams): Promise<Reading> {
	const names = naming(params.packages);
	const { fix } = params;
	const findings: Finding[] = [];
	for (const path of side.paths) {
		const text = await side.read(path);
		if (text === null) continue;
		if (path.endsWith('.json')) {
			findings.push(...manifestFindings(path, text, names, fix));
			continue;
		}
		const source = code(text);
		const found = (target: string, offset: number, kind: string): void => {
			findings.push({
				fingerprint: `${kind} ${target} @ ${path}`,
				path,
				line: lineOf(text, offset),
				message: `${kind} ${target}`,
				fix
			});
		};
		for (const literal of literals(text)) {
			if (!names(literal.value)) continue;
			const before = source.slice(Math.max(0, literal.start - 64), literal.start);
			if (specifierPosition.test(before)) found(literal.value, literal.start, 'imports');
			else if (modulePosition.test(before)) found(literal.value, literal.start, 'declares module');
		}
		for (const match of text.matchAll(referenced)) {
			const target = match[2] ?? '';
			if (names(target)) found(target, match.index, 'references types of');
		}
	}
	return { findings };
}

interface Scanned {
	readonly path: string;
	readonly kind: string;
}

interface Scanner {
	scanImports(code: string): Scanned[];
}

interface Runtime {
	readonly Bun: { readonly Transpiler: new (options: { loader: 'ts' }) => Scanner };
}

function bare(target: string): boolean {
	return !target.startsWith('.') && !target.startsWith('/');
}

function located(text: string, target: string): number {
	for (const quote of ["'", '"', '`']) {
		const offset = text.indexOf(`${quote}${target}${quote}`);
		if (offset !== -1) return offset;
	}
	return 0;
}

async function loads(side: Side, params: LoadsParams): Promise<Reading> {
	const allowed = naming(params.allows);
	const scanner = new (globalThis as unknown as Runtime).Bun.Transpiler({ loader: 'ts' });
	const findings: Finding[] = [];
	for (const path of side.paths) {
		const text = await side.read(path);
		if (text === null) continue;
		const seen = new Set<string>();
		for (const { path: target } of scanner.scanImports(text)) {
			if (!bare(target) || allowed(target) || seen.has(target)) continue;
			seen.add(target);
			findings.push({
				fingerprint: `${target} @ ${path}`,
				path,
				line: lineOf(text, located(text, target)),
				message: `loads ${target} at runtime`,
				fix: params.fix
			});
		}
	}
	return { findings };
}

function prose(text: string): string {
	let out = '';
	let index = 0;
	while (index < text.length) {
		const char = text[index] ?? '';
		const next = text[index + 1];
		if (char === '/' && next === '/') {
			const end = text.indexOf('\n', index);
			const stop = end === -1 ? text.length : end;
			out += blank(text.slice(index, stop));
			index = stop;
		} else if (char === '/' && next === '*') {
			const end = text.indexOf('*/', index + 2);
			const stop = end === -1 ? text.length : end + 2;
			out += blank(text.slice(index, stop));
			index = stop;
		} else if (char === '"' || char === "'" || char === '`') {
			let stop = index + 1;
			while (stop < text.length && text[stop] !== char) stop += text[stop] === '\\' ? 2 : 1;
			out += char + blank(text.slice(index + 1, stop)) + char;
			index = stop + 1;
		} else {
			out += char;
			index += 1;
		}
	}
	return out;
}

function builtin(target: string): boolean {
	return (
		target.startsWith('node:') ||
		target === 'bun' ||
		target.startsWith('bun:') ||
		builtinModules.includes(target.split('/')[0] ?? target)
	);
}

async function builtinsOf(side: Side, params: BuiltinsParams): Promise<Reading> {
	const scanner = new (globalThis as unknown as Runtime).Bun.Transpiler({ loader: 'ts' });
	const globals = new RegExp(`(?<![\\w$#])(?:${params.globals.join('|')})(?![\\w$])`, 'g');
	const member = /(?:^|[^\w$])(?:globalThis|self|window)\s*\??\.\s*$|\?\.\s*$|\.\s*$/;
	const key = /(?:^|[{,;(]|\breadonly)\s*$/;
	const declared = /^\s*\??\s*:/;
	const findings: Finding[] = [];
	for (const path of side.paths) {
		if (params.tests.some((infix) => path.includes(infix))) continue;
		const text = await side.read(path);
		if (text === null) continue;
		const seen = new Set<string>();
		for (const { path: target } of scanner.scanImports(text)) {
			if (!builtin(target) || seen.has(target)) continue;
			seen.add(target);
			findings.push({
				fingerprint: `loads ${target} @ ${path}`,
				path,
				line: lineOf(text, located(text, target)),
				message: `loads the runtime built-in ${target}`,
				fix: params.fix
			});
		}
		const source = prose(text);
		const bound = new Set(
			params.globals.filter((name) =>
				new RegExp(
					`\\b(?:const|let|var|function|class)\\s+${name}(?![\\w$])|[(,]\\s*(?:readonly\\s+)?${name}\\s*\\??:`
				).test(source)
			)
		);
		for (const match of source.matchAll(globals)) {
			const name = match[0];
			if (bound.has(name)) continue;
			const before = source.slice(Math.max(0, match.index - 16), match.index);
			const property = member.exec(before);
			if (
				property !== null &&
				!/globalThis|self|window/.test(property[0]) &&
				name !== 'getBuiltinModule'
			)
				continue;
			const after = source.slice(match.index + name.length, match.index + name.length + 4);
			if (declared.test(after) && key.test(before)) continue;
			if (seen.has(name)) continue;
			seen.add(name);
			findings.push({
				fingerprint: `uses ${name} @ ${path}`,
				path,
				line: lineOf(source, match.index),
				message: `uses the Node-only global ${name}`,
				fix: params.fix
			});
		}
	}
	return { findings };
}

function escaped(word: string): string {
	return word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function wordsOf(side: Side, params: WordsParams): Promise<Reading> {
	const pattern = new RegExp(
		`[\\w$@.:%/-]*(?:${params.words.map(escaped).join('|')})[\\w$@.:%/-]*`,
		'gi'
	);
	const lowered = params.words.map((word) => word.toLowerCase());
	const findings: Finding[] = [];
	for (const path of side.paths) {
		if (params.tests.some((infix) => path.includes(infix))) continue;
		const text = await side.read(path);
		if (text === null) continue;
		let line = 1;
		let scanned = 0;
		for (const match of text.matchAll(pattern)) {
			for (; scanned < match.index; scanned++) if (text[scanned] === '\n') line += 1;
			const token = match[0];
			const word = params.words[lowered.findIndex((item) => token.toLowerCase().includes(item))];
			findings.push({
				fingerprint: `names ${word} @ ${path}`,
				path,
				line,
				message: `names ${token}`,
				fix: params.fix
			});
		}
	}
	return { findings };
}

export default defineProgram<Programs>({
	words: async ({ params, tree, base }) =>
		base === null
			? { tree: await wordsOf(tree, params) }
			: { tree: await wordsOf(tree, params), base: await wordsOf(base, params) },
	builtins: async ({ params, tree, base }) =>
		base === null
			? { tree: await builtinsOf(tree, params) }
			: { tree: await builtinsOf(tree, params), base: await builtinsOf(base, params) },
	loads: async ({ params, tree, base }) =>
		base === null
			? { tree: await loads(tree, params) }
			: { tree: await loads(tree, params), base: await loads(base, params) },
	internals: async ({ params, tree, base }) =>
		base === null
			? { tree: await internals(tree, params) }
			: { tree: await internals(tree, params), base: await internals(base, params) },
	mentions: async ({ params, tree, base }) =>
		base === null
			? { tree: await mentions(tree, params) }
			: { tree: await mentions(tree, params), base: await mentions(base, params) }
});
