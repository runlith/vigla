import { command } from '$app/server';

export const markSeen = command('unchecked', (id) => id);
