import { form } from '$app/server';

export const echo = form('unchecked', async (data) => ({ echoed: data.x }));
