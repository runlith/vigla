export interface Links {
	formFields?: string;
	formValidation?: string;
	prerender?: string;
	prerenderConflicts?: string;
	namedActions?: string;
	enhance?: string;
	transport?: string;
	handle?: string;
	observability?: string;
	fetch?: string;
	adapters?: string;
}

export interface Identity {
	name: string;
	product: string;
	framework?: string;
	plugin: string;
	command: string;
	outDir: string;
	assets: string;
	announcer: string;
	packages: string[];
	diagnostics?: string;
	links?: Links;
	replacedLinkOptions?: Record<string, string>;
}
