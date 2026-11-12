import { isDestroyed, type Effect } from './graph.ts';

export function link(effect: Effect, parent: Effect): void {
	effect.prev = parent.last;
	if (parent.last === null) parent.first = effect;
	else parent.last.next = effect;
	parent.last = effect;
}

export function unlink(effect: Effect): void {
	const parent = effect.parent;
	if (parent === null) return;
	if (effect.prev === null) parent.first = effect.next;
	else effect.prev.next = effect.next;
	if (effect.next === null) parent.last = effect.prev;
	else effect.next.prev = effect.prev;
	effect.prev = effect.next = null;
}

export function sendLast(effect: Effect): void {
	const parent = effect.parent;
	if (isDestroyed(effect) || parent === null || parent.last === effect) return;
	unlink(effect);
	link(effect, parent);
}
