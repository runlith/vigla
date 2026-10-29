const lineSeparators = String.fromCharCode(0x2028, 0x2029);

const bidirectionalControls = String.fromCharCode(
	0x202a,
	0x202b,
	0x202c,
	0x202d,
	0x202e,
	0x2066,
	0x2067,
	0x2068,
	0x2069
);

export const nonLfLineBreak = new RegExp(`\\r(?!\\n)|[${lineSeparators}]`);

export const bidirectionalRun = new RegExp(`[${bidirectionalControls}]+`, 'g');

export const bidirectionalChar = new RegExp(`[${bidirectionalControls}]`);
