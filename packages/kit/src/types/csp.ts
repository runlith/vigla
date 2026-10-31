export type CspAction =
	| 'strict-dynamic'
	| 'report-sample'
	| 'report-sha256'
	| 'report-sha384'
	| 'report-sha512';
export type CspKeyword =
	| 'self'
	| 'unsafe-eval'
	| 'unsafe-hashes'
	| 'unsafe-inline'
	| 'unsafe-allow-redirects'
	| 'unsafe-webtransport-hashes'
	| 'wasm-unsafe-eval'
	| 'trusted-types-eval'
	| 'none';
export type CspHash = `${'nonce' | 'sha256' | 'sha384' | 'sha512'}-${string}`;
export type CspScheme = `${string}:` & {};
export type CspHost =
	`${`${string}://` | ''}${`${string}.${string}` | 'localhost'}${`:${number}` | '' | ':*'}`;
export type CspSource = CspHost | CspScheme | CspHash | CspKeyword;
export type SandboxPermission =
	| 'allow-downloads-without-user-activation'
	| 'allow-forms'
	| 'allow-modals'
	| 'allow-orientation-lock'
	| 'allow-pointer-lock'
	| 'allow-popups'
	| 'allow-popups-to-escape-sandbox'
	| 'allow-presentation'
	| 'allow-same-origin'
	| 'allow-scripts'
	| 'allow-storage-access-by-user-activation'
	| 'allow-top-navigation'
	| 'allow-top-navigation-by-user-activation';
export type ReferrerPolicy =
	| 'no-referrer'
	| 'no-referrer-when-downgrade'
	| 'origin'
	| 'origin-when-cross-origin'
	| 'same-origin'
	| 'strict-origin'
	| 'strict-origin-when-cross-origin'
	| 'unsafe-url'
	| 'none';
export interface CspDirectives {
	'child-src'?: CspSource[];
	'default-src'?: (CspSource | CspAction)[];
	'frame-src'?: CspSource[];
	'worker-src'?: CspSource[];
	'connect-src'?: CspSource[];
	'font-src'?: CspSource[];
	'img-src'?: CspSource[];
	'manifest-src'?: CspSource[];
	'media-src'?: CspSource[];
	'object-src'?: CspSource[];
	'prefetch-src'?: CspSource[];
	'script-src'?: (CspSource | CspAction)[];
	'script-src-elem'?: CspSource[];
	'script-src-attr'?: CspSource[];
	'style-src'?: (CspSource | CspAction)[];
	'style-src-elem'?: CspSource[];
	'style-src-attr'?: CspSource[];
	'base-uri'?: (CspSource | CspAction)[];
	sandbox?: SandboxPermission[];
	'form-action'?: (CspSource | CspAction)[];
	'frame-ancestors'?: (CspHost | CspScheme | 'self' | 'none')[];
	'navigate-to'?: (CspSource | CspAction)[];
	'report-uri'?: string[];
	'report-to'?: string[];
	'require-trusted-types-for'?: 'script'[];
	'trusted-types'?: string[];
	'upgrade-insecure-requests'?: boolean;
	'require-sri-for'?: ('script' | 'style' | 'script style')[];
	'block-all-mixed-content'?: boolean;
	'plugin-types'?: (`${string}/${string}` | 'none')[];
	referrer?: ReferrerPolicy[];
}
export interface CspConfig {
	mode?: 'hash' | 'nonce' | 'auto';
	directives?: CspDirectives;
	reportOnly?: CspDirectives;
}
