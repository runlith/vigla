import { DEV } from 'esm-env';
import type {
	ActionResult,
	Enhancement,
	FormUpdateOptions,
	SubmitFunction,
	SubmitResult
} from '../types/forms.ts';
import { HttpError, FrameworkError } from '../shared/outcomes.ts';
import { client } from './client.ts';
import { enhance_file_without_enctype, enhance_invalid_method } from './errors.ts';
import { identity } from '../shared/identity.ts';

export function deserialize<
	Success extends Record<string, unknown> | undefined = Record<string, any>,
	Failure extends Record<string, unknown> | undefined = Record<string, any>
>(value: string): ActionResult<Success, Failure> {
	const result = JSON.parse(value);
	if (result && typeof result.data === 'string')
		result.data = client('deserialize').transport.parse(result.data);
	return result;
}

export function applyAction<
	Success extends Record<string, unknown> | undefined,
	Failure extends Record<string, unknown> | undefined
>(result: ActionResult<Success, Failure>): Promise<void> {
	return client('applyAction').applyAction(result);
}

export function enhance<
	Success extends Record<string, unknown> | undefined = Record<string, any>,
	Failure extends Record<string, unknown> | undefined = Record<string, any>
>(form: HTMLFormElement, submit: SubmitFunction<Success, Failure> = () => {}): Enhancement {
	const runtime = client('enhance');
	const clone = () => HTMLFormElement.prototype.cloneNode.call(form) as HTMLFormElement;
	if (DEV && clone().method !== 'post') enhance_invalid_method();

	async function update(result: ActionResult, options: FormUpdateOptions = {}): Promise<void> {
		const refresh = options.refreshAll ?? result.type === 'success';
		if (result.type === 'success' && options.reset !== false)
			HTMLFormElement.prototype.reset.call(form);
		const destination =
			options.navigate !== false && result.location ? runtime.url(result.location) : null;
		if (!destination || runtime.routes.outside(destination)) {
			if (refresh && result.type !== 'redirect') await runtime.invalidate(undefined, true);
			await runtime.applyAction(result);
		} else await runtime.applySubmission(destination, result, refresh);
	}

	async function handle(event: SubmitEvent): Promise<void> {
		const submitter = event.submitter as HTMLButtonElement | HTMLInputElement | null;
		const copy = clone();
		const method = submitter?.hasAttribute('formmethod') ? submitter.formMethod : copy.method;
		if (method !== 'post') return;
		event.preventDefault();
		const action = runtime.url(
			submitter?.hasAttribute('formaction') ? submitter.formAction : copy.action
		);
		const enctype = submitter?.hasAttribute('formenctype') ? submitter.formEnctype : copy.enctype;
		const initial = new FormData(form, submitter);
		if (
			DEV &&
			enctype !== 'multipart/form-data' &&
			[...initial.values()].some((value) => value instanceof File)
		)
			enhance_file_without_enctype();
		const controller = new AbortController();
		let cancelled = false;
		const input = {
			action,
			formData: initial,
			formElement: form,
			controller,
			submitter,
			cancel() {
				cancelled = true;
			}
		};
		const callback = await runtime.owner.run(() => submit(input));
		if (cancelled) return;
		const formData = input.formData;
		let result: ActionResult;
		try {
			const headers = new Headers({
				accept: 'application/json',
				[`x-${identity.name}-action`]: 'true'
			});
			let body: FormData | URLSearchParams = formData;
			if (enctype !== 'multipart/form-data') {
				headers.set(
					'content-type',
					['application/x-www-form-urlencoded', 'text/plain'].includes(enctype)
						? enctype
						: 'application/x-www-form-urlencoded'
				);
				body = new URLSearchParams(
					[...formData].map(([key, value]) => [key, typeof value === 'string' ? value : value.name])
				);
			}
			const response = await fetch(action, {
				method: 'POST',
				headers,
				body,
				signal: controller.signal,
				cache: 'no-store'
			});
			runtime.state.notify(response.headers.get(`x-${identity.name}-version`));
			const text = await response.text();
			let parsed: any;
			try {
				parsed = text ? deserialize(text) : undefined;
			} catch (error) {
				if (response.ok && !response.redirected) throw error;
			}
			if (parsed && ['success', 'failure', 'redirect', 'error'].includes(parsed.type)) {
				result = parsed;
				if (result.type === 'failure' || result.type === 'error') result.status = response.status;
			} else if (response.redirected)
				result = { type: 'redirect', status: 303, location: response.url };
			else if (!response.ok) {
				if (parsed && typeof parsed.message === 'string')
					throw new HttpError({ ...parsed, status: response.status });
				throw new FrameworkError(response.status, response.statusText || `HTTP ${response.status}`);
			} else throw new TypeError('Invalid action response');
		} catch (error) {
			if (error instanceof Error && error.name === 'AbortError') return;
			const body = await runtime.pages.error(error, {
				url: action,
				params: {},
				route: { id: null }
			});
			result = { type: 'error', status: body.status, error: body };
		}
		if (callback) {
			await runtime.owner.run(() =>
				callback({
					action,
					formData,
					formElement: form,
					result,
					update: (options) => update(result, options)
				} as SubmitResult<Success, Failure>)
			);
		} else await update(result);
	}
	const listener = (event: Event) => {
		void handle(event as SubmitEvent);
	};
	HTMLFormElement.prototype.addEventListener.call(form, 'submit', listener);
	return {
		destroy() {
			HTMLFormElement.prototype.removeEventListener.call(form, 'submit', listener);
		}
	};
}
