import type { DynamicElement, Element, Namespace, Node } from '../../../ir/nodes.ts';
import type { Report } from '../report.ts';
import { checkAttributes, type Pass } from './attributes.ts';
import { checkElementRules } from './elements.ts';
import { collect } from './facts.ts';
import { checkInteractions } from './interactions.ts';
import { interactivity } from './roles.ts';

export interface ElementContext {
	readonly path: readonly Node[];
	readonly namespace: Namespace;
}

export function checkElement(
	element: Element | DynamicElement,
	context: ElementContext,
	report: Report
): void {
	const facts = collect(element);
	const pass: Pass = { facts, interactivity: interactivity(facts), path: context.path, report };
	checkAttributes(pass);
	checkInteractions(pass);
	checkElementRules(pass);
}
