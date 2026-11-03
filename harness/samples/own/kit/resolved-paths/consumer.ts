import type { ResolvedPathname } from '$app/types';

const root: ResolvedPathname = '/base/';
const absolute: ResolvedPathname = '/base/about';
const relative: ResolvedPathname = './about';
const parent: ResolvedPathname = '../about';
// @ts-expect-error
const doubled: ResolvedPathname = '//';
// @ts-expect-error
const doubledRoot: ResolvedPathname = '/base//';
// @ts-expect-error
const wrongBase: ResolvedPathname = '/else/about';
void [root, absolute, relative, parent, doubled, doubledRoot, wrongBase];
