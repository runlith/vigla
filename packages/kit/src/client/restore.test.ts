// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from 'vitest';
import { Restoration } from './restore.ts';

beforeEach(() => {
	document.body.innerHTML = '';
	window.scrollTo = (x: number | ScrollToOptions = 0, y = 0) => {
		Object.defineProperty(window, 'scrollX', {
			configurable: true,
			value: typeof x === 'number' ? x : (x.left ?? 0)
		});
		Object.defineProperty(window, 'scrollY', { configurable: true, value: y });
	};
	Element.prototype.scrollIntoView = () => {
		window.scrollTo(2, 3);
	};
});

test('focus blurs outgoing SVG elements and restores the fragment tabindex', () => {
	const restore = new Restoration('focus', false);
	document.body.innerHTML = '<svg tabindex="0"></svg><p id="a" tabindex="0"></p><p id="b"></p>';
	const svg = document.querySelector('svg')!;
	svg.focus();
	restore.blur(true);
	expect(document.activeElement).toBe(document.body);
	restore.focus(new URL('https://example.test/#a'));
	expect(document.getElementById('a')?.getAttribute('tabindex')).toBe('0');
	restore.focus(new URL('https://example.test/#b'));
	expect(document.getElementById('b')?.hasAttribute('tabindex')).toBe(false);
	restore.focus(new URL('https://example.test/'));
	expect(document.body.hasAttribute('tabindex')).toBe(false);
});

test('history scroll has priority and disableScroll is consumed even without a reset', () => {
	const restore = new Restoration('scroll', false);
	const url = new URL('https://example.test/#a');
	document.body.innerHTML = '<p id="a"></p>';
	restore.scroll(url, true, { x: 10, y: 20 });
	expect([window.scrollX, window.scrollY]).toEqual([10, 20]);
	restore.disableScroll();
	restore.scroll(url, false);
	restore.scroll(url, true);
	expect([window.scrollX, window.scrollY]).toEqual([2, 3]);
});

test('snapshots and scroll survive a history-entry session-storage restore', () => {
	let value = 'draft';
	const components = [
		{
			snapshot: {
				capture: () => value,
				restore: (next: unknown) => {
					value = String(next);
				}
			}
		}
	];
	const before = new Restoration('snapshots', false);
	window.scrollTo(7, 8);
	before.capture(4, components);
	before.persist();
	value = '';
	const after = new Restoration('snapshots', false);
	after.restore(4, components);
	expect(value).toBe('draft');
	expect(after.position(4)).toEqual({ x: 7, y: 8 });
});
