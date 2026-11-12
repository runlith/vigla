import { realpathSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const entry = realpathSync(fileURLToPath(import.meta.resolve('vigla')));
const source = entry.slice(0, entry.lastIndexOf('/src/') + '/src/'.length);
const props = (await import(join(source, 'runtime/dom/props.ts'))) as { restartIds(): void };

export function before(): void {
	props.restartIds();
}

export function after(): void {}
