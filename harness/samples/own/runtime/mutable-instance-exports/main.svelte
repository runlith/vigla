<script>
	let plain = 0;
	const state = $state(0);
	const raw = $state.raw(0);
	const fixed = 0;
	export { plain, state as value, raw, fixed };
</script>

<p>{state}/{raw}</p>
