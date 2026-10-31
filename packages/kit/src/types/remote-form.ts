import type { StandardSchemaV1 } from '@standard-schema/spec';
import type {
	FieldContainer,
	FieldIssues,
	IsOpenShape,
	OpenFields,
	RemoteFormFields,
	RemoteFormInput
} from './fields.ts';
import type { UpdatingPromise } from './remote.ts';
import type { IsAny, MaybePromise, UnionKeys, UnionValue } from './value.ts';

export type RootFields<Input, Original = Input> =
	IsAny<Input> extends true
		? OpenFields
		: Input extends void
			? FieldIssues
			: IsOpenShape<Input> extends true
				? OpenFields
				: FieldContainer<Original> & {
						[K in UnionKeys<Original>]-?: RemoteFormFields<UnionValue<Original, K>>;
					};
export type FormId<Input> = Input extends { id: infer Id }
	? Id extends string | number
		? Id
		: string | number
	: string | number;
export interface FormAttributes {
	[attachment: symbol]: (element: HTMLFormElement) => void;
	method: 'POST';
	action: string;
}
export interface FormValidationOptions {
	all?: boolean;
	preflightOnly?: boolean;
}
export type RemoteForm<Input extends RemoteFormInput | void, Output> = FormAttributes & {
	readonly element: HTMLFormElement | null;
	submit(): UpdatingPromise<boolean>;
	enhance(callback: RemoteFormEnhanceCallback<Input, Output>): FormAttributes;
	for(id: FormId<Input>): Omit<RemoteForm<Input, Output>, 'for'>;
	preflight(schema: StandardSchemaV1<Input, any>): RemoteForm<Input, Output>;
	validate(options?: FormValidationOptions): Promise<void>;
	readonly result: Output | undefined;
	readonly pending: number;
	readonly submitted: boolean;
	fields: RootFields<Input>;
};
export type RemoteFormEnhanceInstance<
	Input extends RemoteFormInput | void = RemoteFormInput | void,
	Output = any
> = Omit<RemoteForm<Input, Output>, 'enhance' | 'element'> & { readonly element: HTMLFormElement };
export type RemoteFormEnhanceCallback<
	Input extends RemoteFormInput | void = RemoteFormInput | void,
	Output = any
> = (form: RemoteFormEnhanceInstance<Input, Output>) => MaybePromise<void>;
