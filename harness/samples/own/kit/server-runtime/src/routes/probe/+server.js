import { json } from '@sveltejs/kit';
import { calls } from '../../state.js';

export function GET() {
	const result = { ...calls };
	calls.transform = 0;
	return json(result);
}
