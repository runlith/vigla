import type { Adapter, Builder } from '@vigla/kit';
import { throwDiagnostic } from './diagnostics.ts';

function generateManifest(): never {
	throwDiagnostic(
		'adapter_generate_manifest_removed',
		'The `generateManifest` adapter API has been removed — use `generateServerInstance` or `builder.manifest` instead. You may need to update your adapter',
		generateManifest
	);
}

export function retiredBuilder(adapter: Adapter | undefined): Adapter | undefined {
	if (typeof adapter?.adapt !== 'function') return adapter;
	const { adapt } = adapter;
	return {
		...adapter,
		adapt: (builder: Builder) =>
			adapt.call(adapter, Object.create(builder, { generateManifest: { value: generateManifest } }))
	};
}
