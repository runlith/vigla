import type { MaybePromise } from './value.ts';

export type ActionResult<
	Success extends Record<string, unknown> | undefined = Record<string, any>,
	Failure extends Record<string, unknown> | undefined = Record<string, any>
> =
	| { type: 'success'; status: number; data?: Success; location: string }
	| { type: 'failure'; status: number; data?: Failure; location: string }
	| { type: 'redirect'; status: number; location: string }
	| { type: 'error'; status?: number; error: App.Error; location?: string };
export interface FormUpdateOptions {
	reset?: boolean;
	refreshAll?: boolean;
	navigate?: boolean;
}
export interface SubmitInput {
	action: URL;
	formData: FormData;
	formElement: HTMLFormElement;
	controller: AbortController;
	submitter: HTMLElement | null;
	cancel(): void;
}
export interface SubmitResult<
	Success extends Record<string, unknown> | undefined,
	Failure extends Record<string, unknown> | undefined,
	Update extends FormUpdateOptions = FormUpdateOptions
> {
	formData: FormData;
	formElement: HTMLFormElement;
	action: URL;
	result: ActionResult<Success, Failure>;
	update(options?: Update): Promise<void>;
}
export type SubmitFunction<
	Success extends Record<string, unknown> | undefined = Record<string, any>,
	Failure extends Record<string, unknown> | undefined = Record<string, any>,
	Update extends FormUpdateOptions = FormUpdateOptions
> = (
	input: SubmitInput
) => MaybePromise<void | ((result: SubmitResult<Success, Failure, Update>) => MaybePromise<void>)>;
export interface Enhancement {
	destroy(): void;
}
