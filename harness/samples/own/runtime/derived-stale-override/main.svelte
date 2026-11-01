<script>
	let source = $state(1);
	let value = $derived(source);

	export function disconnected() {
		let input = $state(1);
		let output = $derived(input);
		const first = output;
		input = 2;
		output = first;
		return output;
	}
</script>

<button onclick={() => { source = 2; value = 1; }}>override</button>
<p>{value}</p>
