import { form } from '$app/server';

export const seen = form('unchecked', async (data) => ({ intent: data.intent, ids: data.ids ?? [] }));
