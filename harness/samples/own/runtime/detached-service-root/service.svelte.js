export function service() {
	let value = $state.raw(0);
	const stop = $effect.root(() => {
		$effect(() => {
			console.log(`service ${value}`);
		});
	});
	return {
		stop,
		bump(next) {
			value = next;
		}
	};
}
