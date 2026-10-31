import { expect, it } from 'vitest';
import { isEndpoint, isForm, matchesType, negotiate } from './http.ts';

it('selects a weighted representation and lets enhanced actions override negotiation', () => {
	expect(
		negotiate('application/json ; q=0.9, text/html;q=1, */*;q=0.1', [
			'application/json',
			'text/html'
		])
	).toBe('text/html');
	expect(negotiate('text/html,*', ['text/html'])).toBe('text/html');
	expect(negotiate('a'.repeat(200_000), ['text/html'])).toBeUndefined();
	expect(isEndpoint(new Request('http://app/', { headers: { accept: '*/*' } }))).toBe(true);
	expect(
		isEndpoint(
			new Request('http://app/', {
				method: 'POST',
				headers: { accept: 'application/json', 'x-sveltekit-action': 'true' }
			})
		)
	).toBe(false);
});

it('compares media types without case or parameters', () => {
	expect(matchesType('TEXT/HTML ; charset=UTF-8', 'text/html')).toBe(true);
	expect(matchesType('text/html', 'text/plain')).toBe(false);
	expect(
		isForm(
			new Request('http://app/', {
				method: 'POST',
				headers: { 'content-type': 'multipart/form-data; boundary=x' }
			})
		)
	).toBe(true);
});
