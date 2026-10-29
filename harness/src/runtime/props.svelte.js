export function reactive(value) {
	const props = $state(value);
	return props;
}
