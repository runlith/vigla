import { expect, it } from 'vitest';
import { Tracer } from './telemetry.ts';
import { HttpError, Redirect } from '../shared/outcomes.ts';

it('keeps span operations callable when disabled and preserves results and thrown outcomes', async () => {
	const tracer = new Tracer();
	await tracer.init(false);
	const result = await tracer.span('request', {}, async (span) => {
		span.setAttributes({ value: 1 }).setAttribute('name', 'test').addEvent('event');
		expect(span.isRecording()).toBe(false);
		return 42;
	});
	expect(result).toBe(42);
	const redirect = new Redirect(303, '/next');
	await expect(
		tracer.span('request', {}, async () => {
			throw redirect;
		})
	).rejects.toBe(redirect);
});

it('runs through the optional API when enabled without changing HTTP failures', async () => {
	const tracer = new Tracer();
	await tracer.init(true);
	const error = new HttpError({ status: 503, message: 'unavailable' });
	await expect(
		tracer.request(new Request('https://app.test'), () =>
			tracer.span('endpoint', {}, async (span) => {
				expect(span.spanContext().spanId).toHaveLength(16);
				throw error;
			})
		)
	).rejects.toBe(error);
});
