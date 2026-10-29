interface Rule {
	readonly direct?: readonly string[];
	readonly descendant?: readonly string[];
	readonly only?: readonly string[];
	readonly resetBy?: readonly string[];
}

const headings = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

const blocks = [
	'address',
	'article',
	'aside',
	'blockquote',
	'div',
	'dl',
	'fieldset',
	'footer',
	'form',
	'h1',
	'h2',
	'h3',
	'h4',
	'h5',
	'h6',
	'header',
	'hgroup',
	'hr',
	'main',
	'menu',
	'nav',
	'ol',
	'p',
	'pre',
	'section',
	'table',
	'ul'
];

const sections = ['tr', 'style', 'script', 'template'];

const rules: Readonly<Record<string, Rule>> = {
	li: { direct: ['li'] },
	dt: { descendant: ['dt', 'dd'], resetBy: ['dl'] },
	dd: { descendant: ['dt', 'dd'], resetBy: ['dl'] },
	p: { descendant: blocks },
	rt: { descendant: ['rt', 'rp'] },
	rp: { descendant: ['rt', 'rp'] },
	optgroup: { descendant: ['optgroup'] },
	option: { descendant: ['option', 'optgroup'] },
	thead: { only: sections },
	tbody: { only: sections },
	tfoot: { only: sections },
	tr: { only: ['th', 'td', 'style', 'script', 'template'] },
	td: { direct: ['td', 'th', 'tr'] },
	th: { direct: ['td', 'th', 'tr'] },
	form: { descendant: ['form'] },
	a: { descendant: ['a'] },
	button: { descendant: ['button'] },
	h1: { descendant: headings },
	h2: { descendant: headings },
	h3: { descendant: headings },
	h4: { descendant: headings },
	h5: { descendant: headings },
	h6: { descendant: headings },
	colgroup: { only: ['col', 'template'] },
	table: {
		only: ['caption', 'colgroup', 'tbody', 'thead', 'tfoot', 'style', 'script', 'template']
	},
	head: {
		only: [
			'base',
			'basefont',
			'bgsound',
			'link',
			'meta',
			'title',
			'noscript',
			'noframes',
			'style',
			'script',
			'template'
		]
	},
	html: { only: ['head', 'body', 'frameset'] },
	frameset: { only: ['frame'] },
	'#document': { only: ['html'] }
};

function tag(name: string): string {
	return `\`<${name}>\``;
}

export function invalidUnder(child: string, ancestors: readonly string[]): string | null {
	if (child.includes('-')) return null;
	const ancestor = ancestors[ancestors.length - 1] as string;
	const rule = rules[ancestor];
	if (rule === undefined) return null;
	if (rule.resetBy !== undefined) {
		for (let index = ancestors.length - 2; index >= 0; index--) {
			const name = ancestors[index] as string;
			if (name.includes('-')) return null;
			if (rule.resetBy.includes(name)) return null;
		}
	}
	if (rule.descendant?.includes(child))
		return `${tag(child)} cannot be a descendant of ${tag(ancestor)}`;
	return null;
}

export function invalidIn(child: string, parent: string): string | null {
	if (child.includes('-') || parent.includes('-')) return null;
	if (parent === 'template') return null;
	const rule = rules[parent];
	const own = tag(child);
	const outer = tag(parent);
	if (rule !== undefined) {
		if (rule.direct?.includes(child)) return `${own} cannot be a direct child of ${outer}`;
		if (rule.descendant?.includes(child)) return `${own} cannot be a child of ${outer}`;
		if (rule.only !== undefined) {
			if (rule.only.includes(child)) return null;
			return `${own} cannot be a child of ${outer}. ${outer} only allows these children: ${rule.only.map(tag).join(', ')}`;
		}
	}
	switch (child) {
		case 'body':
		case 'caption':
		case 'col':
		case 'colgroup':
		case 'frameset':
		case 'frame':
		case 'head':
		case 'html':
			return `${own} cannot be a child of ${outer}`;
		case 'thead':
		case 'tbody':
		case 'tfoot':
			return `${own} must be the child of a \`<table>\`, not a ${outer}`;
		case 'td':
		case 'th':
			return `${own} must be the child of a \`<tr>\`, not a ${outer}`;
		case 'tr':
			return `\`<tr>\` must be the child of a \`<thead>\`, \`<tbody>\`, or \`<tfoot>\`, not a ${outer}`;
	}
	return null;
}
