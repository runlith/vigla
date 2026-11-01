import { expect, test } from 'vitest';
import { styleExpression } from './styles.ts';
import type { Style } from '../types/internal/server.ts';

test('inlined CSS rebases only known asset URLs without interpreting user strings', () => {
	const css =
		'.sample::before{content:"\\s ` ${not_a_placeholder} __SVELTEKIT_ASSETS_user__ url(./image.png)"} .sample{background:url("./image.png?size=2#part");mask:url(../../../static.svg)} /* url(./image.png) */ .unknown{background:url(/%opaque.png)}';
	const expression = styleExpression(
		css,
		'_app/immutable/assets/page.css',
		new Set(['_app/immutable/assets/image.png']),
		new Set(['static.svg'])
	);
	const render = new Function('return ' + expression)() as Style;
	expect(render('/cdn/', '/prefix/')).toBe(
		css
			.replace(
				'url("./image.png?size=2#part")',
				'url("/cdn/_app/immutable/assets/image.png?size=2#part")'
			)
			.replace('url(../../../static.svg)', 'url(/prefix/static.svg)')
	);
});
