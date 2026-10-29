export interface ActionReturn<
	Parameter = undefined,
	Attributes extends Record<string, unknown> = Record<never, unknown>
> {
	update?: (parameter: Parameter) => void;
	destroy?: () => void;
	$$_attributes?: Attributes;
}

export interface Action<
	E = HTMLElement,
	Parameter = undefined,
	Attributes extends Record<string, unknown> = Record<never, unknown>
> {
	<Node extends E>(
		...args: undefined extends Parameter
			? [node: Node, parameter?: Parameter]
			: [node: Node, parameter: Parameter]
	): void | ActionReturn<Parameter, Attributes>;
}
