import { read } from '$app/server';
import queried from './file.txt?url&v=1';
import uninlined from './file.txt?url&no-inline&v=1';
import hashed from './file.txt?url&no-inline#part';

async function text(url) {
	try {
		return await read(url).text();
	} catch (error) {
		return `${error.message}`;
	}
}

export async function GET() {
	return Response.json({
		queried: await text(queried),
		uninlined: await text(uninlined),
		hashed: await text(hashed)
	});
}
