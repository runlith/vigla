import * as core from 'vigla/server';
import { format } from '../shared/format.ts';

export * from 'vigla/server';

export function render<P extends core.Props>(
	component: core.Component<P>,
	options: core.RenderOptions<P> = {}
): core.Rendering {
	return core.render(component, { ...options, format: options.format ?? format });
}
