import { DEV } from 'esm-env';
import { asset as resolveAsset } from '$app/paths';
import type { AssetPath } from '$app/types';
import { warnDiagnostic } from '../diagnostics.ts';

export * from '$app/paths';

export function asset(file: AssetPath): string {
	if (!file.startsWith('/')) return resolveAsset(file);
	const fixed = file.slice(1) as AssetPath;
	if (DEV)
		warnDiagnostic(
			'asset_leading_slash',
			`\`asset('${file}')\` should now be \`asset('${fixed}')\``
		);
	return resolveAsset(fixed);
}
