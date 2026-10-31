export interface RuntimeNames {
	readonly [operation: string]: string;
}

export interface Runtime {
	readonly client: string;
	readonly server: string;
	readonly names?: RuntimeNames;
}
