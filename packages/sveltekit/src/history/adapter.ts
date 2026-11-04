import type { Adapter, Builder } from '@vigla/kit';
import { throwDiagnostic, warnDiagnostic } from './diagnostics.ts';

function generateManifest(): never {
	throwDiagnostic(
		'adapter_generate_manifest_removed',
		'The `generateManifest` adapter API has been removed — use `generateServerInstance` or `builder.manifest` instead. You may need to update your adapter',
		generateManifest
	);
}

function configWithKit(config: Builder['config']): Builder['config'] {
	let warned = false;
	return Object.create(config, {
		kit: {
			get() {
				if (!warned) {
					warned = true;
					warnDiagnostic(
						'adapter_config_kit_deprecated',
						'Reading `config.kit` inside adapters is deprecated — it should access configuration on the `config` object directly. You may need to update your adapter'
					);
				}
				return config;
			}
		}
	});
}

export function retiredBuilder(adapter: Adapter | undefined): Adapter | undefined {
	if (typeof adapter?.adapt !== 'function') return adapter;
	const { adapt } = adapter;
	return {
		...adapter,
		adapt: (builder: Builder) =>
			adapt.call(
				adapter,
				Object.create(builder, {
					generateManifest: { value: generateManifest },
					config: { value: configWithKit(builder.config) }
				})
			)
	};
}
