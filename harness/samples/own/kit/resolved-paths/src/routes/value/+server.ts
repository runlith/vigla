import { resolve } from '$app/paths';

export const GET = () => new Response(resolve('/about'));
