import { DEV } from 'esm-env';
import { warnCode, warnDiagnostic } from './diagnostics.ts';

interface SchemeWarning {
	route: string;
	dependency: string;
	scheme: string;
}

export function form_fields_enumerated(): void {
	if (DEV)
		warnDiagnostic(
			'form_fields_enumerated',
			'The properties of `form.fields` are virtual, so operators like `in` and `Object.keys` are meaningless. If you need the current value of a form field, use `form.fields.x.value()`'
		);
	else warnCode('form_fields_enumerated');
}
export function depends_special_scheme(values: SchemeWarning): void {
	if (DEV)
		warnDiagnostic(
			'depends_special_scheme',
			`\`${values.route}\`: Calling \`depends('${values.dependency}')\` will throw an error in Firefox because \`${values.scheme}\` is a special URI scheme`
		);
	else warnCode('depends_special_scheme');
}
