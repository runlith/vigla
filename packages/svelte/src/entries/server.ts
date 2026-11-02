import * as core from 'vigla/server';
import { failure } from 'vigla/internal/server';
import { format } from '../shared/format.ts';

export * from 'vigla/server';

export interface Rendered extends core.Rendered {
	readonly html: string;
}

export type Rendering = Rendered & PromiseLike<Rendered>;

export function render<P extends core.Props>(
	component: core.Component<P>,
	options: core.RenderOptions<P> = {}
): Rendering {
	const result = core.render(component, {
		...options,
		format: options.format ?? format,
		inheritContext: options.inheritContext ?? false
	});
	return {
		get head() {
			return result.head;
		},
		get body() {
			return result.body;
		},
		get html() {
			return result.body;
		},
		get hashes() {
			return result.hashes;
		},
		then(fulfilled, rejected) {
			return Promise.resolve(result)
				.then((value): Rendered => ({
					...value,
					get html(): string {
						throw failure(
							'html_deprecated',
							'The `html` property of server render results has been deprecated. Use `body` instead.'
						);
					}
				}))
				.then(fulfilled, rejected);
		}
	};
}
