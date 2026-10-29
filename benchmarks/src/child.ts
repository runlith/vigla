import { pathToFileURL } from 'node:url';
import type { Listed, Measured } from './protocol.ts';

interface Entry extends Listed {
	fn(): Promise<Measured>;
}

const index = process.env.BENCH_INDEX;
const label = process.env.BENCH_LABEL;
if (index === undefined) throw new Error('BENCH_INDEX names no benchmark index');

const { default: entries } = (await import(pathToFileURL(index).href)) as { default: Entry[] };

function send(message: unknown): void {
	process.send?.(message, () => process.exit(0));
}

if (label === undefined) {
	send(entries.map(({ suite, label }): Listed => ({ suite, label })));
} else {
	const entry = entries.find((candidate) => candidate.label === label);
	if (entry === undefined) throw new Error(`no benchmark ${label}`);
	send(await entry.fn());
}
