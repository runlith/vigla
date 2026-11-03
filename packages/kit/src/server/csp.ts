import type { CspConfig, CspDirectives } from '../types/csp.ts';
import { base64, sha256 } from '../shared/hash.ts';
import { escapeHtml } from '../shared/escape.ts';
import * as errors from './errors.ts';

const keywords = new Set([
	'self',
	'unsafe-eval',
	'unsafe-hashes',
	'unsafe-inline',
	'none',
	'strict-dynamic',
	'report-sample',
	'report-sha256',
	'report-sha384',
	'report-sha512',
	'wasm-unsafe-eval',
	'trusted-types-eval',
	'unsafe-allow-redirects',
	'unsafe-webtransport-hashes',
	'script'
]);
type Sources = Record<string, string[] | boolean | undefined>;

class Policy {
	readonly #directives: Sources;
	readonly #added = new Map<string, Set<string>>();
	readonly script: boolean;
	readonly style: boolean;

	constructor(directives: CspDirectives, dev: boolean) {
		this.#directives = { ...directives };
		if (dev) {
			for (const key of ['style-src', 'style-src-attr', 'style-src-elem']) {
				const value =
					this.#directives[key] ??
					(key === 'style-src' ? this.#directives['default-src'] : undefined);
				if (Array.isArray(value) && !value.includes('unsafe-inline'))
					this.#directives[key] = [
						...value.filter((source) => !/^(nonce|sha\d+)-/.test(source)),
						'unsafe-inline'
					];
			}
		}
		this.script = ['script-src', 'script-src-elem'].some((key) => this.#needs(key));
		this.style =
			!dev && ['style-src', 'style-src-attr', 'style-src-elem'].some((key) => this.#needs(key));
	}

	#needs(key: string): boolean {
		const value =
			this.#directives[key] ??
			(key === 'script-src' || key === 'style-src' ? this.#directives['default-src'] : undefined);
		return (
			Array.isArray(value) &&
			(!value.includes('unsafe-inline') ||
				(key.startsWith('script') && value.includes('strict-dynamic')))
		);
	}

	add(kind: 'script' | 'style', source: string): void {
		if (kind === 'style' && !this.style) return;
		const keys =
			kind === 'script'
				? ['script-src', 'script-src-elem']
				: ['style-src', 'style-src-attr', 'style-src-elem'];
		for (const key of keys) {
			if (!this.#needs(key)) continue;
			const values = this.#added.get(key) ?? new Set<string>();
			if (key === 'style-src-elem')
				values.add('sha256-9OlNO0DNEeaVzHL4RZwCLsBHA8WBQ8toBp/4F5XV2nc=');
			values.add(source);
			this.#added.set(key, values);
		}
	}

	header(meta = false): string {
		const values: Sources = { ...this.#directives };
		for (const [key, added] of this.#added) {
			const base =
				values[key] ?? (key === 'script-src' || key === 'style-src' ? values['default-src'] : []);
			values[key] = [...new Set([...(Array.isArray(base) ? base : []), ...added])];
		}
		return Object.entries(values)
			.flatMap(([name, value]) => {
				if (!value || (meta && ['frame-ancestors', 'report-uri', 'sandbox'].includes(name)))
					return [];
				return [
					[
						name,
						...(Array.isArray(value)
							? value.map((source) =>
									keywords.has(source) || /^(nonce|sha\d+)-/.test(source) ? `'${source}'` : source
								)
							: [])
					].join(' ')
				];
			})
			.join('; ');
	}
}

export class Csp {
	readonly nonce = base64(crypto.getRandomValues(new Uint8Array(16)));
	readonly #enforced: Policy;
	readonly #report: Policy;
	readonly hashes: boolean;

	constructor(config: CspConfig, prerender: boolean, dev: boolean) {
		if (prerender && config.mode === 'nonce') errors.prerender_nonce();
		this.hashes = config.mode === 'hash' || ((config.mode ?? 'auto') === 'auto' && prerender);
		this.#enforced = new Policy(config.directives ?? {}, dev);
		this.#report = new Policy(config.reportOnly ?? {}, dev);
		if (
			Object.values(config.reportOnly ?? {}).some(Boolean) &&
			!config.reportOnly?.['report-uri']?.length &&
			!config.reportOnly?.['report-to']?.length
		)
			errors.csp_report_only_missing_report();
	}

	get scriptNonce(): boolean {
		return !this.hashes && (this.#enforced.script || this.#report.script);
	}
	get styleNonce(): boolean {
		return !this.hashes && (this.#enforced.style || this.#report.style);
	}
	get scriptHash(): boolean {
		return this.hashes && (this.#enforced.script || this.#report.script);
	}

	async script(content: string): Promise<void> {
		if (!this.#enforced.script && !this.#report.script) return;
		const source = this.hashes ? `sha256-${await sha256(content)}` : `nonce-${this.nonce}`;
		this.#enforced.add('script', source);
		this.#report.add('script', source);
	}

	scriptHashes(hashes: readonly string[]): void {
		for (const hash of hashes) {
			this.#enforced.add('script', hash);
			this.#report.add('script', hash);
		}
	}

	async style(content: string): Promise<void> {
		if (!this.#enforced.style && !this.#report.style) return;
		const source = this.hashes ? `sha256-${await sha256(content)}` : `nonce-${this.nonce}`;
		this.#enforced.add('style', source);
		this.#report.add('style', source);
	}

	apply(headers: Headers): void {
		const enforced = this.#enforced.header();
		const report = this.#report.header();
		if (enforced) headers.set('content-security-policy', enforced);
		if (report) headers.set('content-security-policy-report-only', report);
	}

	meta(): string {
		const value = this.#enforced.header(true);
		return value
			? `<meta http-equiv="content-security-policy" content="${escapeHtml(value, true)}">`
			: '';
	}
}
