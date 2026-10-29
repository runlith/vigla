export const ariaAttributes: readonly string[] =
	'activedescendant atomic autocomplete braillelabel brailleroledescription busy checked colcount colindex colspan controls current describedby description details disabled dropeffect errormessage expanded flowto grabbed haspopup hidden invalid keyshortcuts label labelledby level live modal multiline multiselectable orientation owns placeholder posinset pressed readonly relevant required roledescription rowcount rowindex rowspan selected setsize sort valuemax valuemin valuenow valuetext'.split(
		' '
	);

export const ariaAttributeSet: ReadonlySet<string> = new Set(ariaAttributes);

export const requiredAttributes: ReadonlyMap<string, readonly string[]> = new Map([
	['area', ['alt', 'aria-label', 'aria-labelledby']],
	['html', ['lang']],
	['iframe', ['title']],
	['img', ['alt']],
	['object', ['title', 'aria-label', 'aria-labelledby']]
]);

export const distractingElements: ReadonlySet<string> = new Set(['blink', 'marquee']);

export const headings: ReadonlySet<string> = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

export const labelable: ReadonlySet<string> = new Set([
	'button',
	'input',
	'keygen',
	'meter',
	'output',
	'progress',
	'select',
	'textarea'
]);

export const interactiveHandlers: ReadonlySet<string> = new Set([
	'keypress',
	'keydown',
	'keyup',
	'click',
	'contextmenu',
	'dblclick',
	'drag',
	'dragend',
	'dragenter',
	'dragexit',
	'dragleave',
	'dragover',
	'dragstart',
	'drop',
	'mousedown',
	'mouseenter',
	'mouseleave',
	'mousemove',
	'mouseout',
	'mouseover',
	'mouseup',
	'pointerdown',
	'pointerup',
	'pointermove',
	'pointerenter',
	'pointerleave',
	'pointerover',
	'pointerout',
	'pointercancel',
	'touchstart',
	'touchend',
	'touchmove',
	'touchcancel'
]);

export const recommendedInteractiveHandlers: ReadonlySet<string> = new Set([
	'click',
	'mousedown',
	'mouseup',
	'keypress',
	'keydown',
	'keyup'
]);

export const nestedImplicitSemantics: ReadonlyMap<string, string> = new Map([
	['header', 'banner'],
	['footer', 'contentinfo']
]);

export const implicitSemantics: ReadonlyMap<string, string> = new Map([
	['a', 'link'],
	['area', 'link'],
	['article', 'article'],
	['aside', 'complementary'],
	['body', 'document'],
	['button', 'button'],
	['datalist', 'listbox'],
	['dd', 'definition'],
	['dfn', 'term'],
	['dialog', 'dialog'],
	['details', 'group'],
	['dt', 'term'],
	['fieldset', 'group'],
	['figure', 'figure'],
	['form', 'form'],
	['h1', 'heading'],
	['h2', 'heading'],
	['h3', 'heading'],
	['h4', 'heading'],
	['h5', 'heading'],
	['h6', 'heading'],
	['hr', 'separator'],
	['img', 'img'],
	['li', 'listitem'],
	['link', 'link'],
	['main', 'main'],
	['menu', 'list'],
	['meter', 'progressbar'],
	['nav', 'navigation'],
	['ol', 'list'],
	['option', 'option'],
	['optgroup', 'group'],
	['output', 'status'],
	['progress', 'progressbar'],
	['section', 'region'],
	['summary', 'button'],
	['table', 'table'],
	['tbody', 'rowgroup'],
	['textarea', 'textbox'],
	['tfoot', 'rowgroup'],
	['thead', 'rowgroup'],
	['tr', 'row'],
	['ul', 'list']
]);

export const menuitemRoles: ReadonlyMap<string, string> = new Map([
	['command', 'menuitem'],
	['checkbox', 'menuitemcheckbox'],
	['radio', 'menuitemradio']
]);

export const inputRoles: ReadonlyMap<string, string> = new Map([
	['button', 'button'],
	['image', 'button'],
	['reset', 'button'],
	['submit', 'button'],
	['checkbox', 'checkbox'],
	['radio', 'radio'],
	['range', 'slider'],
	['number', 'spinbutton'],
	['email', 'textbox'],
	['search', 'searchbox'],
	['tel', 'textbox'],
	['text', 'textbox'],
	['url', 'textbox']
]);

const containerRoles = ['listbox', 'menu', 'menubar', 'radiogroup', 'tablist', 'tree', 'treegrid'];

export const interactiveRoleExceptions: ReadonlyMap<string, ReadonlySet<string>> = new Map([
	['ul', new Set(containerRoles)],
	['ol', new Set(containerRoles)],
	['menu', new Set(containerRoles)],
	['li', new Set(['menuitem', 'option', 'row', 'tab', 'treeitem'])],
	['table', new Set(['grid'])],
	['td', new Set(['gridcell'])],
	['fieldset', new Set(['radiogroup', 'presentation'])]
]);

export const comboboxIfList: ReadonlySet<string> = new Set([
	'email',
	'search',
	'tel',
	'text',
	'url'
]);

export const addressTypeTokens: ReadonlySet<string> = new Set(['shipping', 'billing']);

export const autofillFieldNameTokens: ReadonlySet<string> = new Set([
	'',
	'on',
	'off',
	'name',
	'honorific-prefix',
	'given-name',
	'additional-name',
	'family-name',
	'honorific-suffix',
	'nickname',
	'username',
	'new-password',
	'current-password',
	'one-time-code',
	'organization-title',
	'organization',
	'street-address',
	'address-line1',
	'address-line2',
	'address-line3',
	'address-level4',
	'address-level3',
	'address-level2',
	'address-level1',
	'country',
	'country-name',
	'postal-code',
	'cc-name',
	'cc-given-name',
	'cc-additional-name',
	'cc-family-name',
	'cc-number',
	'cc-exp',
	'cc-exp-month',
	'cc-exp-year',
	'cc-csc',
	'cc-type',
	'transaction-currency',
	'transaction-amount',
	'language',
	'bday',
	'bday-day',
	'bday-month',
	'bday-year',
	'sex',
	'url',
	'photo'
]);

export const contactTypeTokens: ReadonlySet<string> = new Set([
	'home',
	'work',
	'mobile',
	'fax',
	'pager'
]);

export const autofillContactFieldNameTokens: ReadonlySet<string> = new Set([
	'tel',
	'tel-country-code',
	'tel-national',
	'tel-area-code',
	'tel-local',
	'tel-local-prefix',
	'tel-local-suffix',
	'tel-extension',
	'email',
	'impp'
]);

export const invisibleElements: ReadonlySet<string> = new Set(['meta', 'html', 'script', 'style']);

export const presentationRoles: ReadonlySet<string> = new Set(['presentation', 'none']);

export const contentEditableBindings: ReadonlySet<string> = new Set([
	'textContent',
	'innerHTML',
	'innerText'
]);
