import { expect, it, vi } from 'vitest';
import { Tracer } from './telemetry.ts';

vi.mock('@opentelemetry/api', () => {
	throw new Error('optional package missing');
});

it('fails initialization when tracing was requested but its optional API cannot load', async () => {
	await expect(new Tracer().init(true)).rejects.toThrow('tracing_api_missing');
});
