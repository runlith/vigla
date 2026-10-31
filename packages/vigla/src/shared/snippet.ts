export interface RawSnippet {
	render(): string;
	setup?(element: Element): void | (() => void);
}

export type SnippetArgs<Values extends unknown[]> = {
	[Key in keyof Values]: () => Values[Key];
};

export type RawFactory<Values extends unknown[]> = (...args: SnippetArgs<Values>) => RawSnippet;
