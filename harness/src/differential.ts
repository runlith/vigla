import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { locate } from './resolve.ts';

interface Compiler {
	parse(source: string, options?: Record<string, unknown>): unknown;
	print(ast: unknown): { code: string };
}

type Mode = 'parse' | 'print' | 'fuzz';

const root = resolve(import.meta.dirname, '../..');
const corpus = join(root, '.external/svelte/packages/svelte/tests');
const parseOptions = [{}, { modern: true }, { modern: true, loose: true }];
const junk = [
	'{',
	'<',
	'"',
	'}',
	'/',
	'>',
	'{#if a}',
	'</div>',
	'{:else}',
	'&amp',
	'<!--',
	'`',
	"'",
	'{/',
	'<C.'
];

async function compiler(target: string): Promise<Compiler> {
	const found = locate(join(root, target), 'svelte');
	const entry = found.exports['./compiler'];
	const file =
		typeof entry === 'string'
			? entry
			: ((entry as Record<string, string>).default ?? (entry as Record<string, string>).import);
	return (await import(pathToFileURL(join(found.root, file as string)).href)) as Compiler;
}

function sources(filter: string | undefined): string[] {
	const files: string[] = [];
	const walk = (dir: string): void => {
		for (const name of readdirSync(dir)) {
			if (name === 'node_modules' || name === '_output') continue;
			const path = join(dir, name);
			if (statSync(path).isDirectory()) walk(path);
			else if (name.endsWith('.svelte') && (filter === undefined || path.includes(filter))) {
				files.push(path);
			}
		}
	};
	walk(corpus);
	return files.sort();
}

function outcome(run: () => unknown): string {
	try {
		return JSON.stringify(run(), (_, value) => (typeof value === 'bigint' ? `${value}n` : value));
	} catch (error) {
		const failure = error as { code?: string; message?: string; position?: unknown };
		return `ERR ${failure.code ?? 'throw'} ${JSON.stringify(failure.position ?? null)} ${(failure.message ?? '').split('\n')[0]}`;
	}
}

function difference(a: string, b: string): string {
	let at = 0;
	while (at < a.length && a[at] === b[at]) at++;
	const from = Math.max(0, at - 80);
	return `upstream=${a.slice(from, at + 120)}\n   vigla=${b.slice(from, at + 120)}`;
}

function variants(source: string, seed: { value: number }): string[] {
	const random = (n: number): number => {
		seed.value = (seed.value * 1103515245 + 12345) & 0x7fffffff;
		return seed.value % n;
	};
	const out: string[] = [];
	for (let round = 0; round < 6; round++) {
		const cut = random(source.length + 1);
		out.push(source.slice(0, cut));
		out.push(source.slice(0, cut) + source.slice(Math.min(source.length, cut + 1 + random(5))));
		out.push(source.slice(0, cut) + (junk[random(junk.length)] as string) + source.slice(cut));
	}
	return out;
}

function argument(name: string): string | undefined {
	const index = process.argv.indexOf(name);
	return index === -1 ? undefined : process.argv[index + 1];
}

const mode = (process.argv[2] ?? 'parse') as Mode;
if (!['parse', 'print', 'fuzz'].includes(mode)) {
	console.error('usage: differential.ts parse|print|fuzz [--filter <path part>] [--step <n>]');
	process.exit(2);
}
const upstream = await compiler('targets/upstream');
const vigla = await compiler('targets/vigla');
const files = sources(argument('--filter'));
const step = Number(argument('--step') ?? (mode === 'fuzz' ? 7 : 1));
const seed = { value: 12345 };
let same = 0;
let different = 0;

let upstreamThrew = 0;

const compare = (label: string, a: string, b: string): void => {
	if (a === b) {
		same++;
		return;
	}
	if (a.startsWith('ERR throw ')) {
		upstreamThrew++;
		return;
	}
	different++;
	console.log(`DIFF ${label}\n   ${difference(a, b)}`);
};

for (let index = 0; index < files.length; index += step) {
	const file = files[index] as string;
	const source = readFileSync(file, 'utf8');
	const name = file.slice(corpus.length + 1);
	if (mode === 'print') {
		const printed = (compiler: Compiler) => () =>
			compiler.print(compiler.parse(source, { modern: true })).code;
		compare(name, outcome(printed(upstream)), outcome(printed(vigla)));
		continue;
	}
	const inputs = mode === 'fuzz' ? (source.length > 3000 ? [] : variants(source, seed)) : [source];
	inputs.forEach((input, variant) => {
		for (const options of parseOptions) {
			compare(
				`${name}${mode === 'fuzz' ? ` #${variant}` : ''} ${JSON.stringify(options)}`,
				outcome(() => upstream.parse(input, options)),
				outcome(() => vigla.parse(input, options))
			);
		}
	});
}

console.log(JSON.stringify({ mode, files: files.length, same, different, upstreamThrew }));
process.exit(different === 0 ? 0 : 1);
