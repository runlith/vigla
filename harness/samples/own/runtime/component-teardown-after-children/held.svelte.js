export function held(name) {
	$effect(() => () => console.log(name));
}
