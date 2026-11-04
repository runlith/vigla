// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from 'vitest';
import { stringify } from 'devalue';
import { Restoration } from './restore.ts';

beforeEach(() => {
	sessionStorage.clear();
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
	const restore = new Restoration(false);
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
	const restore = new Restoration(false);
	const url = new URL('https://example.test/#a');
	document.body.innerHTML = '<p id="a"></p>';
	restore.scroll(url, true, { x: 10, y: 20 });
	expect([window.scrollX, window.scrollY]).toEqual([10, 20]);
	restore.disableScroll();
	restore.scroll(url, false);
	restore.scroll(url, true);
	expect([window.scrollX, window.scrollY]).toEqual([2, 3]);
});

test("history records persist as upstream's three session-storage records under the identity", () => {
	let value = '';
	let registered: unknown;
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
	sessionStorage.setItem('vigla:history-info', JSON.stringify({ 4: { scroll: { x: 7, y: 8 } } }));
	sessionStorage.setItem('vigla:snapshot', JSON.stringify({ 2: ['draft'] }));
	sessionStorage.setItem(
		'vigla:navigation-snapshot',
		JSON.stringify({ 4: { form: stringify('kept') } })
	);
	const restoration = new Restoration(false);
	restoration.register(
		'form',
		{ capture: () => 'next', restore: (next) => (registered = next) },
		4
	);
	restoration.restore({ index: 4, navigation: 2 }, components);
	expect([value, registered]).toEqual(['draft', 'kept']);
	expect(restoration.position(4)).toEqual({ x: 7, y: 8 });
	value = 'edited';
	window.scrollTo(1, 2);
	restoration.capture({ index: 5, navigation: 2 }, components);
	restoration.persist();
	expect(JSON.parse(sessionStorage.getItem('vigla:history-info')!)[5]).toEqual({
		scroll: { x: 1, y: 2 }
	});
	expect(JSON.parse(sessionStorage.getItem('vigla:snapshot')!)).toEqual({ 2: ['edited'] });
	expect(JSON.parse(sessionStorage.getItem('vigla:navigation-snapshot')!)[5]).toEqual({
		form: stringify('next')
	});
});

test('a captured void snapshot still invokes its restore callback', () => {
	let restored = 0;
	const components = [
		{
			snapshot: {
				capture: () => {},
				restore: () => {
					restored++;
				}
			}
		}
	];
	const restoration = new Restoration(false);
	restoration.capture({ index: 1, navigation: 1 }, components);
	restoration.restore({ index: 1, navigation: 1 }, components);
	expect(restored).toBe(1);
});
