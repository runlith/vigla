import path from 'node:path';
import type { Plugin } from 'vite';
import { identity } from '../identity.ts';
import { warnDiagnostic } from './diagnostics.ts';

type Mode = 'code' | 'single' | 'double' | 'template' | 'line' | 'block' | 'html';

const quotes: Partial<Record<Mode, string>> = { single: "'", double: '"', template: '`' };
const pageOption = /(export\s+const\s+(prerender|csr|ssr|trailingSlash))\s*=/s;
const scripts = /<script\b[^>]*>([\s\S]*?)<\/script>/g;
const warned = new Set<string>();
const docs = 'https://svelte.dev/docs/kit/';

function insideStringOrComment(source: string, end: number): boolean {
	let mode: Mode = 'code';
	for (let index = 0; index < end; index++) {
		const char = source[index]!;
		const pair = source.slice(index, index + 2);
		if (mode === 'line') {
			if (char === '\n') mode = 'code';
		} else if (mode === 'block') {
			if (pair === '*/') {
				mode = 'code';
				index++;
			}
		} else if (mode === 'html') {
			if (source.startsWith('-->', index)) {
				mode = 'code';
				index += 2;
			}
		} else if (mode !== 'code') {
			if (char === '\\') index++;
			else if (char === quotes[mode]) mode = 'code';
		} else if (char === "'") mode = 'single';
		else if (char === '"') mode = 'double';
		else if (char === '`') mode = 'template';
		else if (pair === '//') {
			mode = 'line';
			index++;
		} else if (pair === '/*') {
			mode = 'block';
			index++;
		} else if (source.startsWith('<!--', index)) {
			mode = 'html';
			index += 3;
		}
	}
	return mode !== 'code';
}

function hasChildren(source: string): boolean {
	return (
		source.includes('<slot') ||
		source.includes('{@render') ||
		source.includes('{children}') ||
		source.includes('children={')
	);
}

function once(key: string, warn: () => void): void {
	if (warned.has(key)) return;
	warned.add(key);
	warn();
}

export function componentWarnings(): Plugin {
	return {
		name: `${identity.name}:history-components`,
		transform: {
			filter: { id: /[/\\]\+(?:page|layout)[^/\\]*\.svelte$/ },
			handler(code, id) {
				const name = path.basename(id.split('?')[0]!);
				const file = path.relative(process.cwd(), id.split('?')[0]!);
				for (const script of code.matchAll(scripts)) {
					const content = script[1]!;
					const match = pageOption.exec(content);
					if (match && !insideStringOrComment(content, match.index))
						once(`page_option_in_component:${file}:${match[1]}`, () =>
							warnDiagnostic(
								'page_option_in_component',
								`\`${file}\`: \`${match[1]}\` will be ignored — move it to \`${name.replace('.svelte', '(.server).js/ts')}\` instead. See ${docs}page-options for more information.`
							)
						);
				}
				if (name.startsWith('+layout.') && !hasChildren(code))
					once(`layout_children_missing:${file}`, () =>
						warnDiagnostic(
							'layout_children_missing',
							`\`${file}\`: \`<slot />\` or \`{@render ...}\` tag missing — inner content will not be rendered`
						)
					);
				return null;
			}
		}
	};
}
