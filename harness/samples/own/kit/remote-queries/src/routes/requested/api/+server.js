import { json } from '@sveltejs/kit';
import { bump } from '../items.remote.js';

export const POST = async () => json({ result: await bump() });
