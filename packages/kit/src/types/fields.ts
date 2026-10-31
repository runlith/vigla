import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { DeepPartial, UnionKeys, UnionValue } from './value.ts';

export interface ImageCoordinates {
	x: number;
	y: number;
}
export type IsImage<T> = T extends ImageCoordinates
	? Exclude<keyof T, keyof ImageCoordinates> extends never
		? true
		: false
	: false;
export type IsOpenShape<T> = unknown extends T ? true : string extends keyof T ? true : false;
export interface InputValues {
	text: string;
	email: string;
	password: string;
	url: string;
	tel: string;
	search: string;
	number: number;
	range: number;
	date: string;
	'datetime-local': string;
	time: string;
	month: string;
	week: string;
	color: string;
	checkbox: boolean | string[];
	radio: string;
	file: File;
	hidden: string | number | boolean;
	submit: string | number | boolean;
	button: string;
	reset: string;
	image: ImageCoordinates;
	select: string;
	'select multiple': string[];
	'file multiple': File[];
}
export type RemoteFormFieldType<Value> = {
	[Type in keyof InputValues]: Value extends InputValues[Type] ? Type : never;
}[keyof InputValues];
export interface FieldAttributes {
	name: string;
	'aria-invalid': boolean | 'false' | 'true' | undefined;
}
export interface CheckedAttributes<Type> extends FieldAttributes {
	type: Type;
	value?: string;
	checked: boolean;
	readonly defaultChecked?: boolean;
}
export interface ImageAttributes extends FieldAttributes {
	type: 'image';
}
export interface FileAttributes extends FieldAttributes {
	type: 'file';
	files: FileList | null;
}
export interface SelectAttributes extends FieldAttributes {
	value: string;
}
export interface MultiSelectAttributes extends FieldAttributes {
	multiple: true;
	value: string[];
}
export interface TextAttributes<Value> extends FieldAttributes {
	value: Value extends string ? string : string | number;
	readonly defaultValue?: Value extends string ? string : string | number;
}
export interface ValueAttributes<Type> extends FieldAttributes {
	type: Type;
	value: string | number;
	readonly defaultValue?: string | number;
}
export type InputAttributes<Type extends keyof InputValues, Value> = Type extends
	| 'checkbox'
	| 'radio'
	? CheckedAttributes<Type>
	: Type extends 'image'
		? ImageAttributes
		: Type extends 'file'
			? FileAttributes
			: Type extends 'select'
				? SelectAttributes
				: Type extends 'select multiple'
					? MultiSelectAttributes
					: Type extends 'text'
						? TextAttributes<Value>
						: ValueAttributes<Type>;
export interface RemoteFormIssue {
	message: string;
	path: (string | number)[];
}
export interface FieldIssues {
	issues(): RemoteFormIssue[] | undefined;
	allIssues(): RemoteFormIssue[] | undefined;
}
export interface FieldMethods<Value> {
	value(): DeepPartial<Value>;
	set(value: DeepPartial<Value>): DeepPartial<Value>;
	touched(): boolean;
	dirty(): boolean;
	issues(): RemoteFormIssue[] | undefined;
}
export interface FieldContainer<Value> extends FieldMethods<Value> {
	allIssues(): RemoteFormIssue[] | undefined;
}
export type RemoteFormFieldValue =
	| string
	| string[]
	| number
	| boolean
	| File
	| File[]
	| ImageCoordinates;
export type FieldArgs<Type extends keyof InputValues, Value> = Type extends 'checkbox'
	? Value extends string[]
		? [type: Type, value: Value[number] | (string & {}), checked?: boolean]
		: Value extends boolean
			? [type: Type, value?: boolean]
			: [type: Type, value?: Value]
	: Type extends 'image' | 'file' | 'file multiple'
		? [type: Type]
		: Type extends 'submit' | 'hidden'
			? [type: Type, value: Value extends string ? Value | (string & {}) : Value]
			: Type extends 'radio'
				? [type: Type, value: Value | (string & {}), checked?: boolean]
				: [type: Type, value?: Value];
type WidenText<T> = T extends string ? string : T;
export type RemoteFormField<Value extends RemoteFormFieldValue> = FieldMethods<Value> & {
	as<Type extends RemoteFormFieldType<Value>>(
		...args: FieldArgs<Type, Value>
	): InputAttributes<Type, WidenText<Value>>;
};
export type UnknownField<Value> = FieldContainer<Value> & {
	as<Type extends RemoteFormFieldType<Value>>(
		...args: FieldArgs<Type, Value>
	): InputAttributes<Type, Value>;
} & { [key: string | number]: UnknownField<any> };
export type OpenFields = FieldContainer<any> & { [key: string | number]: UnknownField<any> };
type ObjectFields<T> = { [K in UnionKeys<T>]-?: RemoteFormFields<UnionValue<T, K>> };
export type RemoteFormFields<Value> =
	IsOpenShape<Value> extends true
		? OpenFields
		: NonNullable<Value> extends string | number | boolean | File
			? RemoteFormField<NonNullable<Value>>
			: IsImage<NonNullable<Value>> extends true
				? RemoteFormField<NonNullable<Value> & ImageCoordinates> &
						Pick<FieldIssues, 'allIssues'> &
						ObjectFields<Value>
				: [NonNullable<Value>] extends [string[] | File[]]
					? RemoteFormField<NonNullable<Value>> & {
							[index: number]: RemoteFormField<NonNullable<Value>[number]>;
						}
					: [NonNullable<Value>] extends [Array<infer Element>]
						? FieldContainer<NonNullable<Value>> & { [index: number]: RemoteFormFields<Element> }
						: FieldContainer<Value> & ObjectFields<Value>;
export type RemoteFormInvalidField<Value> =
	IsOpenShape<Value> extends true
		? Record<string | number, any>
		: NonNullable<Value> extends string | number | boolean | File
			? (message: string) => StandardSchemaV1.Issue
			: NonNullable<Value> extends Array<infer Element>
				? { [index: number]: RemoteFormInvalidField<Element> } & ((
						message: string
					) => StandardSchemaV1.Issue)
				: NonNullable<Value> extends RemoteFormInput
					? { [K in keyof Value]-?: RemoteFormInvalidField<Value[K]> } & ((
							message: string
						) => StandardSchemaV1.Issue)
					: Record<string, never>;
export type FormValue = string | number | boolean | File | RemoteFormInput;
export interface RemoteFormInput {
	[key: string]: FormValue | FormValue[] | undefined;
}
