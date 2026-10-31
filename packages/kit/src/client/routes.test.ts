// @vitest-environment jsdom
import { expect, test } from 'vitest';
import { load_css } from './entry.ts';

test('server-resolved route styles share a load and a failed stylesheet can be retried', async () => {
	const first = load_css(['/layout.css']);
	const other = load_css(['/layout.css']);
	const link = document.querySelector<HTMLLinkElement>('link[href$="/layout.css"]')!;
	link.dispatchEvent(new Event('error'));
	await expect(first).rejects.toBeInstanceOf(Error);
	await expect(other).rejects.toBeInstanceOf(Error);
	expect(link.isConnected).toBe(false);
	const retry = load_css(['/layout.css']);
	const fresh = document.querySelector<HTMLLinkElement>('link[href$="/layout.css"]')!;
	fresh.dispatchEvent(new Event('load'));
	await retry;
	expect(fresh.rel).toBe('stylesheet');
	expect(fresh.crossOrigin).toBe('');
	fresh.remove();
});
