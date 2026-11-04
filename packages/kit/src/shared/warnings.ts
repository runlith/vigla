import { DEV } from 'esm-env';
import { warnCode, warnDiagnostic } from './diagnostics.ts';

interface AssetWarning {
	path: string;
	fixed: string;
}
interface SchemeWarning {
	route: string;
	dependency: string;
	scheme: string;
}

export function error_body_deprecated(): void {
	if (DEV)
		warnDiagnostic(
			'error_body_deprecated',
			'Passing an `App.Error` body as the second argument is deprecated — pass the `message` as the second argument, and any additional properties as the third'
		);
	else warnCode('error_body_deprecated');
}
export function asset_leading_slash(values: AssetWarning): void {
	if (DEV)
		warnDiagnostic(
			'asset_leading_slash',
			`\`asset('${values.path}')\` should now be \`asset('${values.fixed}')\``
		);
	else warnCode('asset_leading_slash');
}
export function handle_error_status_deprecated(): void {
	if (DEV)
		warnDiagnostic(
			'handle_error_status_deprecated',
			'The `status` property of `handleError` is deprecated. Use `error.status` for expected and framework errors, or `500` for unexpected errors.'
		);
	else warnCode('handle_error_status_deprecated');
}
export function handle_error_message_deprecated(): void {
	if (DEV)
		warnDiagnostic(
			'handle_error_message_deprecated',
			"The `message` property of `handleError` is deprecated. Use `error.message` for expected and framework errors, or `'Internal Error'` for unexpected errors."
		);
	else warnCode('handle_error_message_deprecated');
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
