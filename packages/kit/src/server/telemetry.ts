import type { Attributes, Span, SpanContext } from '@opentelemetry/api';
import { HttpError, Redirect } from '../shared/outcomes.ts';
import * as errors from './errors.ts';

const emptyContext: SpanContext = {
	traceId: '00000000000000000000000000000000',
	spanId: '0000000000000000',
	traceFlags: 0
};
export const noopSpan: Span = {
	spanContext: () => emptyContext,
	setAttribute() {
		return this;
	},
	setAttributes() {
		return this;
	},
	addEvent() {
		return this;
	},
	addLink() {
		return this;
	},
	addLinks() {
		return this;
	},
	setStatus() {
		return this;
	},
	updateName() {
		return this;
	},
	end() {},
	isRecording: () => false,
	recordException() {}
};

type Api = typeof import('@opentelemetry/api');

export class Tracer {
	#api: Api | null = null;

	async init(enabled: boolean): Promise<void> {
		if (!enabled) return;
		try {
			this.#api = await import('@opentelemetry/api');
		} catch {
			errors.tracing_api_missing();
		}
	}

	current(): Span {
		return this.#api?.trace.getSpan(this.#api.context.active()) ?? noopSpan;
	}

	request<T>(request: Request, fn: () => Promise<T>): Promise<T> {
		const api = this.#api;
		if (!api) return fn();
		const context = api.propagation.extract(api.context.active(), request.headers, {
			get: (headers, key) => headers.get(key) ?? undefined,
			keys: (headers) => [...headers.keys()]
		});
		return api.context.with(context, () =>
			this.span('sveltekit.request', { 'http.method': request.method, 'http.url': request.url }, fn)
		);
	}

	async span<T>(name: string, attributes: Attributes, fn: (span: Span) => Promise<T>): Promise<T> {
		const api = this.#api;
		if (!api) return fn(noopSpan);
		return api.trace.getTracer('sveltekit').startActiveSpan(name, { attributes }, async (span) => {
			try {
				return await fn(span);
			} catch (error) {
				if (error instanceof Redirect)
					span.setAttributes({
						[`${name}.result.type`]: 'redirect',
						[`${name}.result.status`]: error.status,
						[`${name}.result.location`]: error.location
					});
				else if (error instanceof HttpError) {
					span.setAttributes({
						[`${name}.result.type`]: 'known_error',
						[`${name}.result.status`]: error.status,
						[`${name}.result.message`]: error.body.message
					});
					if (error.status >= 500) {
						span.recordException({ name: 'HttpError', message: error.body.message });
						span.setStatus({ code: api.SpanStatusCode.ERROR, message: error.body.message });
					}
				} else {
					span.setAttribute(`${name}.result.type`, 'unknown_error');
					if (error instanceof Error) span.recordException(error);
					span.setStatus({
						code: api.SpanStatusCode.ERROR,
						...(error instanceof Error ? { message: error.message } : {})
					});
				}
				throw error;
			} finally {
				span.end();
			}
		});
	}
}
