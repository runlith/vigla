import { tick } from 'vigla';
import { DEV } from 'esm-env';
import {
	coerceFormValue,
	parseFormKey,
	splitPath,
	DELETE_KEY,
	type FormKey
} from '../../shared/form-fields.ts';
import {
	enhance_file_without_enctype,
	remote_form_mixed_inputs,
	remote_form_multiple_files,
	remote_form_reserved_field
} from '../errors.ts';
import type { Form } from './form.ts';

function clone(form: HTMLFormElement): HTMLFormElement {
	return HTMLFormElement.prototype.cloneNode.call(form) as HTMLFormElement;
}

export function formData(form: HTMLFormElement, submitter?: HTMLElement | null): FormData {
	const button =
		submitter ??
		form.querySelector<HTMLElement>('button:not([type]), [type="submit"], [type="image"]');
	return new FormData(form, button);
}

export function validateFormData(element: HTMLFormElement, data: FormData): void {
	if (!DEV) return;
	for (const key of data.keys()) if (/^\$[.[]?/.test(key)) remote_form_reserved_field();
	if (
		clone(element).enctype !== 'multipart/form-data' &&
		[...data.values()].some((value) => value instanceof File)
	)
		enhance_file_without_enctype();
}

export function attach(form: Form, element: HTMLFormElement): () => void {
	let previous: FormKey | null = null;
	const submit = (event: SubmitEvent): void => {
		const copy = clone(element);
		const submitter = event.submitter as HTMLInputElement | HTMLButtonElement | null;
		const method = submitter?.hasAttribute('formmethod') ? submitter.formMethod : copy.method;
		if (method !== 'post') return;
		const action = new URL(
			submitter?.hasAttribute('formaction') ? submitter.formAction : copy.action,
			document.baseURI
		);
		if (action.searchParams.get('/remote') !== form.actionId) return;
		const target = submitter?.hasAttribute('formtarget') ? submitter.formTarget : copy.target;
		if (target === '_blank') return;
		event.preventDefault();
		const data = new FormData(element, submitter);
		if (
			previous &&
			![...data.keys()].some((key) => parseFormKey(form.forms.id, key).name === previous!.name)
		)
			form.write(splitPath(previous.name), undefined);
		previous = null;
		if (submitter && submitter.type !== 'image' && submitter.hasAttribute('name')) {
			previous = parseFormKey(form.forms.id, submitter.name);
			form.write(splitPath(previous.name), coerceFormValue(previous.type, submitter.value));
		}
		validateFormData(element, data);
		void form.enhance(element, data);
	};

	const input = (event: Event): void => {
		const control = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
		if (!control.name) return;
		const field = parseFormKey(form.forms.id, control.name);
		const isFile = control.type === 'file';
		let value: any;
		if (field.isArray) {
			if (control instanceof HTMLSelectElement)
				value = [...control.selectedOptions].map((option) => option.value);
			else {
				const controls = [...element.elements].filter(
					(candidate): candidate is HTMLInputElement =>
						candidate instanceof HTMLInputElement && candidate.name === control.name
				);
				if (DEV && controls.some((candidate) => (candidate.type === 'file') !== isFile))
					remote_form_mixed_inputs({ name: control.name });
				value = isFile
					? controls.flatMap((candidate) => [...(candidate.files ?? [])])
					: controls
							.filter((candidate) => candidate.type !== 'checkbox' || candidate.checked)
							.map((candidate) => candidate.value);
			}
		} else if (isFile) {
			const file = control as HTMLInputElement;
			if (DEV && file.multiple) remote_form_multiple_files({ name: control.name });
			value = file.files?.[0] ?? DELETE_KEY;
		} else
			value =
				control instanceof HTMLInputElement && control.type === 'checkbox' && !control.checked
					? null
					: control.value;
		form.input(field.name, isFile ? value : coerceFormValue(field.type, value));
	};
	const blur = (event: Event): void => {
		const name = (event.target as HTMLInputElement).name;
		if (name) form.touch(parseFormKey(form.forms.id, name).name);
	};
	const reset = (): void => {
		void tick().then(() => {
			if (form.element === element) form.reset(new FormData(element));
		});
	};
	element.addEventListener('submit', submit);
	element.addEventListener('input', input);
	element.addEventListener('focusout', blur);
	element.addEventListener('reset', reset);
	return () => {
		element.removeEventListener('submit', submit);
		element.removeEventListener('input', input);
		element.removeEventListener('focusout', blur);
		element.removeEventListener('reset', reset);
	};
}
