import { resolve } from '$app/paths';
import type { RouteId } from '$app/types';

declare const route: RouteId;
resolve(route);
resolve('/blog/entry-0');
// @ts-expect-error
resolve('/not-a-route');
