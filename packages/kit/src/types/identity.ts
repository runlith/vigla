export interface Links {
	formFields?: string;
	formValidation?: string;
	prerender?: string;
}

export interface Identity {
	name: string;
	product: string;
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
