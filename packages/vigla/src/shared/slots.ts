export type SlotNames = Readonly<Record<string, boolean>>;

const names = new WeakMap<object, SlotNames>();

interface Slotted {
	readonly children?: unknown;
}

export function slotProps<P extends object>(props: P, slots: SlotNames): P {
	names.set(props, slots);
	return props;
}

export function slots(props: Slotted): SlotNames {
	return names.get(props) ?? (props.children === undefined ? {} : { default: true });
}
