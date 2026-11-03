import { expect, it } from 'vitest';
import { Csp } from './csp.ts';
import { sha256 } from '../shared/hash.ts';

it('authorizes each inline script with one request nonce in both enforced policies', async () => {
	const csp = new Csp(
		{
			directives: { 'default-src': ['self'], 'script-src-elem': ['self'] },
			reportOnly: { 'script-src': ['none'], 'report-uri': ['/report'] }
		},
		false,
		false
	);
	await csp.script('start()');
	await csp.style('body{}');
	const headers = new Headers();
	csp.apply(headers);
	expect(headers.get('content-security-policy')).toContain(
		`script-src 'self' 'nonce-${csp.nonce}'`
	);
	expect(headers.get('content-security-policy')).toContain(`style-src 'self' 'nonce-${csp.nonce}'`);
	expect(headers.get('content-security-policy-report-only')).toContain(`'nonce-${csp.nonce}'`);
	expect(csp.scriptNonce).toBe(true);
});

it('includes the core hydration hash and its own boot hash for prerendered documents', async () => {
	const csp = new Csp(
		{ mode: 'auto', directives: { 'default-src': ['self'], 'frame-ancestors': ['none'] } },
		true,
		false
	);
	await csp.script('start()');
	csp.scriptHashes(['sha256-core']);
	const headers = new Headers();
	csp.apply(headers);
	expect(headers.get('content-security-policy')).toContain(`'sha256-${await sha256('start()')}'`);
	expect(headers.get('content-security-policy')).toContain("'sha256-core'");
	expect(csp.meta()).not.toContain('frame-ancestors');
	expect(csp.scriptHash).toBe(true);
});

it('keeps unsafe-inline usable for dev styles while strict-dynamic still protects scripts', async () => {
	const csp = new Csp(
		{
			directives: {
				'script-src': ['unsafe-inline', 'strict-dynamic'],
				'style-src': ['sha256-old'],
				'style-src-attr': ['unsafe-inline']
			}
		},
		false,
		true
	);
	await csp.script('start()');
	await csp.style('body{}');
	const headers = new Headers();
	csp.apply(headers);
	expect(headers.get('content-security-policy')).toContain("style-src 'unsafe-inline'");
	expect(headers.get('content-security-policy')).toMatch(/style-src-attr 'unsafe-inline'(;|$)/);
	expect(headers.get('content-security-policy')).toContain(`'nonce-${csp.nonce}'`);
	expect(csp.styleNonce).toBe(false);
});
