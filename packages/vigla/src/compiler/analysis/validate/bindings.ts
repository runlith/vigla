import type * as ES from 'estree';
import { isSvg } from '../../../shared/html.ts';
import type * as IR from '../../ir/nodes.ts';
import { closest } from './a11y/fuzzy.ts';
import { assignment } from './assignment.ts';
import type { Context } from './context.ts';
import { fail, nameOf } from './report.ts';
import { base } from './scope.ts';

interface Property {
	readonly valid?: readonly string[];
	readonly invalid?: readonly string[];
}

const media = ['audio', 'video'];
const windowOnly = [':window'];
const documentOnly = [':document'];
const notGlobal = [':window', ':document'];

const properties: Readonly<Record<string, Property>> = {
	currentTime: { valid: media },
	duration: { valid: media },
	focused: {},
	paused: { valid: media },
	buffered: { valid: media },
	seekable: { valid: media },
	played: { valid: media },
	volume: { valid: media },
	muted: { valid: media },
	playbackRate: { valid: media },
	seeking: { valid: media },
	ended: { valid: media },
	readyState: { valid: media },
	videoHeight: { valid: ['video'] },
	videoWidth: { valid: ['video'] },
	naturalWidth: { valid: ['img'] },
	naturalHeight: { valid: ['img'] },
	activeElement: { valid: documentOnly },
	fullscreenElement: { valid: documentOnly },
	pointerLockElement: { valid: documentOnly },
	visibilityState: { valid: documentOnly },
	innerWidth: { valid: windowOnly },
	innerHeight: { valid: windowOnly },
	outerWidth: { valid: windowOnly },
	outerHeight: { valid: windowOnly },
	scrollX: { valid: windowOnly },
	scrollY: { valid: windowOnly },
	online: { valid: windowOnly },
	devicePixelRatio: { valid: windowOnly },
	clientWidth: { invalid: notGlobal },
	clientHeight: { invalid: notGlobal },
	offsetWidth: { invalid: notGlobal },
	offsetHeight: { invalid: notGlobal },
	contentRect: { invalid: notGlobal },
	contentBoxSize: { invalid: notGlobal },
	borderBoxSize: { invalid: notGlobal },
	devicePixelContentBoxSize: { invalid: notGlobal },
	indeterminate: { valid: ['input'] },
	checked: { valid: ['input'] },
	group: { valid: ['input'] },
	this: {},
	innerText: { invalid: notGlobal },
	innerHTML: { invalid: notGlobal },
	textContent: { invalid: notGlobal },
	open: { valid: ['details'] },
	value: { valid: ['input', 'textarea', 'select'] },
	files: { valid: ['input'] }
};

const names = Object.keys(properties);

const editable = new Set(['textContent', 'innerHTML', 'innerText']);

export type Host = IR.Element | IR.DynamicElement | IR.Special;

function keyOf(host: Host): string {
	if (host.kind === 'element') return host.name;
	if (host.kind === 'dynamic-element') return ':element';
	return `:${host.target}`;
}

function shown(key: string): string {
	return key.startsWith(':') ? nameOf(key.slice(1)) : key;
}

function attributeNamed(host: Host, name: string): IR.Property | undefined {
	return host.attributes.find((a): a is IR.Property => a.kind === 'attribute' && a.name === name);
}

export function textOf(attribute: IR.Property): string | null {
	const value = attribute.value;
	if (value.kind !== 'text' || value.parts.length !== 1) return null;
	const part = value.parts[0] as IR.Text | IR.Expression;
	return part.kind === 'text' ? part.data : null;
}

function target(node: IR.Binding, host: Host): void {
	const parent = keyOf(host);
	const property = properties[node.name];
	if (property === undefined) {
		const match = closest(node.name, names);
		if (match !== null) {
			const found = properties[match] as Property;
			if (found.valid === undefined || found.valid.includes(parent)) {
				fail('bind_invalid_name', node, {
					name: node.name,
					explanation: `Did you mean '${match}'?`
				});
			}
		}
		fail('bind_invalid_name', node, { name: node.name });
	}
	if (property.valid !== undefined && !property.valid.includes(parent)) {
		fail('bind_invalid_target', node, {
			name: node.name,
			elements: property.valid.map((valid) => `\`<${shown(valid)}>\``).join(', ')
		});
	}
	if (property.invalid?.includes(parent)) {
		const valid = names
			.filter((name) => {
				const candidate = properties[name] as Property;
				return (
					candidate.valid?.includes(parent) ||
					(candidate.valid === undefined && !candidate.invalid?.includes(parent))
				);
			})
			.sort();
		fail('bind_invalid_name', node, {
			name: node.name,
			explanation: `Possible bindings for <${shown(parent)}> are ${valid.join(', ')}`
		});
	}
	if (parent === 'input' && node.name !== 'this') {
		const type = attributeNamed(host, 'type');
		if (type !== undefined && textOf(type) === null) {
			if (node.name !== 'value' || type.value.kind === 'boolean')
				fail('attribute_invalid_type', type);
		} else {
			const kind = type === undefined ? undefined : textOf(type);
			if (node.name === 'checked' && kind !== 'checkbox') {
				const radio = kind === 'radio' ? ' — for `<input type="radio">`, use `bind:group`' : '';
				fail('bind_invalid_target', node, {
					name: node.name,
					elements: `\`<input type="checkbox">\`${radio}`
				});
			}
			if (node.name === 'files' && kind !== 'file') {
				fail('bind_invalid_target', node, { name: node.name, elements: '`<input type="file">`' });
			}
		}
	}
	if (parent === 'select' && node.name !== 'this') {
		const multiple = attributeNamed(host, 'multiple');
		if (multiple !== undefined && textOf(multiple) === null && multiple.value.kind !== 'boolean') {
			fail('attribute_invalid_multiple', multiple);
		}
	}
	if (node.name === 'offsetWidth' && isSvg(parent)) {
		fail('bind_invalid_target', node, {
			name: node.name,
			elements: 'non-`<svg>` elements. Use `bind:clientWidth` for `<svg>` instead'
		});
	}
	if (editable.has(node.name)) {
		const contenteditable = attributeNamed(host, 'contenteditable');
		if (contenteditable === undefined) fail('attribute_contenteditable_missing', node);
		else if (textOf(contenteditable) === null && contenteditable.value.kind !== 'boolean') {
			fail('attribute_contenteditable_dynamic', contenteditable);
		}
	}
}

export function binding(context: Context, node: IR.Binding, host: Host | null): void {
	if (host !== null) target(node, host);
	const expression = node.expression;
	if (expression.type === 'SequenceExpression') {
		if (node.name === 'group') fail('bind_group_invalid_expression', node);
		if (expression.expressions.length !== 2) fail('bind_invalid_expression', node);
		const [get, set] = expression.expressions as [ES.Expression, ES.Expression];
		context.es(get.type === 'ArrowFunctionExpression' ? (get.body as ES.Node) : get);
		context.es(set.type === 'ArrowFunctionExpression' ? (set.body as ES.Node) : set);
		return;
	}
	assignment(context, node, expression, true);
	const left = base(expression);
	if (left === null) fail('bind_invalid_expression', node);
	const found = context.scope.get(left.name);
	if (expression.type === 'Identifier' && node.name !== 'this') {
		const kind = found?.kind;
		if (
			found === null ||
			(kind !== 'state' &&
				kind !== 'raw_state' &&
				kind !== 'prop' &&
				kind !== 'bindable_prop' &&
				kind !== 'each' &&
				kind !== 'store_sub' &&
				!found.updated)
		) {
			fail('bind_invalid_value', expression);
		}
	}
	if (node.name === 'group' && found?.kind === 'snippet')
		fail('bind_group_invalid_snippet_parameter', node);
	if (found?.kind === 'each' && found.insideRest) {
		context.report.warn('bind_invalid_each_rest', found.node, { name: found.node.name });
	}
	context.es(expression);
}
