import { json } from '@sveltejs/kit';
import { state } from '../state.js';

export const GET = () => json(state.open);
