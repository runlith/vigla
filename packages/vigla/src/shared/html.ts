const voids = new Set([
	'area',
	'base',
	'br',
	'col',
	'command',
	'embed',
	'hr',
	'img',
	'input',
	'keygen',
	'link',
	'meta',
	'param',
	'source',
	'track',
	'wbr'
]);

export function isVoid(name: string): boolean {
	const lower = name.toLowerCase();
	return voids.has(lower) || lower === '!doctype';
}

const reservedTags = new Set([
	'annotation-xml',
	'color-profile',
	'font-face',
	'font-face-format',
	'font-face-name',
	'font-face-src',
	'font-face-uri',
	'missing-glyph'
]);

export function isCustomTag(name: string): boolean {
	return name.includes('-') && !reservedTags.has(name.toLowerCase());
}

const rawText = new Set(['textarea', 'script', 'style', 'title']);

export function isRawText(name: string): boolean {
	return rawText.has(name);
}

const booleans = new Set([
	'allowfullscreen',
	'async',
	'autofocus',
	'autoplay',
	'checked',
	'controls',
	'default',
	'disabled',
	'formnovalidate',
	'indeterminate',
	'inert',
	'ismap',
	'loop',
	'multiple',
	'muted',
	'nomodule',
	'novalidate',
	'open',
	'playsinline',
	'readonly',
	'required',
	'reversed',
	'seamless',
	'selected',
	'webkitdirectory',
	'defer',
	'disablepictureinpicture',
	'disableremoteplayback'
]);

export function isBooleanAttribute(name: string): boolean {
	return booleans.has(name);
}

const aliases: Readonly<Record<string, string>> = {
	formnovalidate: 'formNoValidate',
	ismap: 'isMap',
	nomodule: 'noModule',
	playsinline: 'playsInline',
	readonly: 'readOnly',
	defaultvalue: 'defaultValue',
	defaultchecked: 'defaultChecked',
	srcobject: 'srcObject',
	novalidate: 'noValidate',
	allowfullscreen: 'allowFullscreen',
	disablepictureinpicture: 'disablePictureInPicture',
	disableremoteplayback: 'disableRemotePlayback'
};

export function propertyName(name: string): string {
	const lower = name.toLowerCase();
	return aliases[lower] ?? lower;
}

const properties = new Set([
	...booleans,
	'formNoValidate',
	'isMap',
	'noModule',
	'playsInline',
	'readOnly',
	'value',
	'volume',
	'defaultValue',
	'defaultChecked',
	'srcObject',
	'noValidate',
	'allowFullscreen',
	'disablePictureInPicture',
	'disableRemotePlayback'
]);

export function isProperty(name: string): boolean {
	return properties.has(name);
}

const delegated = new Set([
	'beforeinput',
	'click',
	'change',
	'dblclick',
	'contextmenu',
	'focusin',
	'focusout',
	'input',
	'keydown',
	'keyup',
	'mousedown',
	'mousemove',
	'mouseout',
	'mouseover',
	'mouseup',
	'pointerdown',
	'pointermove',
	'pointerout',
	'pointerover',
	'pointerup',
	'touchend',
	'touchmove',
	'touchstart'
]);

export function isDelegated(event: string): boolean {
	return delegated.has(event);
}

export function isPassive(event: string): boolean {
	return event === 'touchstart' || event === 'touchmove';
}

export function isCapture(name: string): boolean {
	return name.endsWith('capture') && name !== 'gotpointercapture' && name !== 'lostpointercapture';
}

const svg = new Set([
	'altGlyph',
	'altGlyphDef',
	'altGlyphItem',
	'animate',
	'animateColor',
	'animateMotion',
	'animateTransform',
	'circle',
	'clipPath',
	'color-profile',
	'cursor',
	'defs',
	'desc',
	'discard',
	'ellipse',
	'feBlend',
	'feColorMatrix',
	'feComponentTransfer',
	'feComposite',
	'feConvolveMatrix',
	'feDiffuseLighting',
	'feDisplacementMap',
	'feDistantLight',
	'feDropShadow',
	'feFlood',
	'feFuncA',
	'feFuncB',
	'feFuncG',
	'feFuncR',
	'feGaussianBlur',
	'feImage',
	'feMerge',
	'feMergeNode',
	'feMorphology',
	'feOffset',
	'fePointLight',
	'feSpecularLighting',
	'feSpotLight',
	'feTile',
	'feTurbulence',
	'filter',
	'font',
	'font-face',
	'font-face-format',
	'font-face-name',
	'font-face-src',
	'font-face-uri',
	'foreignObject',
	'g',
	'glyph',
	'glyphRef',
	'hatch',
	'hatchpath',
	'hkern',
	'image',
	'line',
	'linearGradient',
	'marker',
	'mask',
	'mesh',
	'meshgradient',
	'meshpatch',
	'meshrow',
	'metadata',
	'missing-glyph',
	'mpath',
	'path',
	'pattern',
	'polygon',
	'polyline',
	'radialGradient',
	'rect',
	'set',
	'solidcolor',
	'stop',
	'svg',
	'switch',
	'symbol',
	'text',
	'textPath',
	'tref',
	'tspan',
	'unknown',
	'use',
	'view',
	'vkern'
]);

export function isSvg(name: string): boolean {
	return svg.has(name);
}

const mathml = new Set([
	'annotation',
	'annotation-xml',
	'maction',
	'math',
	'merror',
	'mfrac',
	'mi',
	'mmultiscripts',
	'mn',
	'mo',
	'mover',
	'mpadded',
	'mphantom',
	'mprescripts',
	'mroot',
	'mrow',
	'ms',
	'mspace',
	'msqrt',
	'mstyle',
	'msub',
	'msubsup',
	'msup',
	'mtable',
	'mtd',
	'mtext',
	'mtr',
	'munder',
	'munderover',
	'semantics'
]);

export function isMathml(name: string): boolean {
	return mathml.has(name);
}

export const validTag =
	/^[a-zA-Z][a-zA-Z0-9]*(-[a-zA-Z0-9.\-_\u{B7}\u{C0}-\u{D6}\u{D8}-\u{F6}\u{F8}-\u{37D}\u{37F}-\u{1FFF}\u{200C}-\u{200D}\u{203F}-\u{2040}\u{2070}-\u{218F}\u{2C00}-\u{2FEF}\u{3001}-\u{D7FF}\u{F900}-\u{FDCF}\u{FDF0}-\u{FFFD}\u{10000}-\u{EFFFF}]*)?$/u;

export const namespaces = {
	html: 'http://www.w3.org/1999/xhtml',
	svg: 'http://www.w3.org/2000/svg',
	mathml: 'http://www.w3.org/1998/Math/MathML'
} as const;
